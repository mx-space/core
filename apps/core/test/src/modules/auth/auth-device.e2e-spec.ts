import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { APIError } from 'better-auth/api'
import { bearer, deviceAuthorization } from 'better-auth/plugins'

const CLIENT_ID = 'mxs-cli'

type DeviceAuth = ReturnType<typeof buildAuth>['auth']

function buildAuth(verificationUri = '/device') {
  const db: Record<string, any[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
    deviceCode: [],
  }
  const auth = betterAuth({
    telemetry: { enabled: false },
    appName: 'mx-core-test',
    secret: 'test-secret-test-secret-test-secret-12345',
    baseURL: 'http://localhost/auth',
    emailAndPassword: { enabled: true, disableSignUp: false },
    database: memoryAdapter(db),
    plugins: [
      bearer(),
      deviceAuthorization({
        expiresIn: '30m',
        interval: '5s',
        userCodeLength: 8,
        verificationUri,
        schema: {},
        onDeviceAuthRequest: async (clientId) => {
          if (clientId !== CLIENT_ID) {
            throw new APIError('BAD_REQUEST', {
              error: 'invalid_client',
              error_description: `unsupported client_id: ${clientId}`,
            })
          }
        },
      }),
    ],
  })
  return { auth, db }
}

async function signUpOwner(auth: DeviceAuth) {
  const result = await auth.api.signUpEmail({
    body: {
      email: 'owner@example.com',
      password: 'sup3r-secure-pw!',
      name: 'Owner',
    },
    returnHeaders: true,
  })
  const headers = new Headers()
  const setCookie = result.headers.get('set-cookie')
  if (setCookie) {
    headers.set('cookie', setCookie)
  }
  const user = (result.response as { user?: { id?: string } }).user ?? null
  return { headers, user }
}

describe('deviceAuthorization plugin (e2e)', () => {
  test('rejects clients that are not mxs-cli', async () => {
    const { auth } = buildAuth()
    await expect(
      auth.api.deviceCode({
        body: { client_id: 'other-client', scope: 'openid' },
      }),
    ).rejects.toMatchObject({
      body: { error: 'invalid_client' },
    })
  })

  test('issues a device code, verification uri, and polling interval', async () => {
    const { auth } = buildAuth('/api/v2/device')
    const res = await auth.api.deviceCode({
      body: { client_id: CLIENT_ID, scope: 'openid profile' },
    })
    expect(res.device_code).toBeTypeOf('string')
    expect(res.user_code).toMatch(/^[\dA-Z]{8}$/)
    expect(res.verification_uri).toContain('/api/v2/device')
    expect(res.verification_uri_complete).toContain(
      `user_code=${res.user_code}`,
    )
    expect(res.expires_in).toBe(30 * 60)
    expect(res.interval).toBe(5)
  })

  test('device token endpoint returns authorization_pending until approval, then issues a session', async () => {
    const { auth, db } = buildAuth()
    const owner = await signUpOwner(auth)
    expect(owner.user?.id).toBeTypeOf('string')

    const code = await auth.api.deviceCode({
      body: { client_id: CLIENT_ID, scope: 'openid' },
    })

    await expect(
      auth.api.deviceToken({
        body: {
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: code.device_code,
          client_id: CLIENT_ID,
        },
      }),
    ).rejects.toMatchObject({
      body: { error: 'authorization_pending' },
    })

    await auth.api.deviceVerify({
      query: { user_code: code.user_code },
      headers: owner.headers,
    })
    await auth.api.deviceApprove({
      body: { userCode: code.user_code },
      headers: owner.headers,
    })

    const record = db.deviceCode!.find(
      (r) => r.deviceCode === code.device_code,
    )!
    record.lastPolledAt = null
    record.pollingInterval = 0

    const tokenRes = await auth.api.deviceToken({
      body: {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: code.device_code,
        client_id: CLIENT_ID,
      },
    })
    expect(tokenRes).toMatchObject({
      token_type: 'Bearer',
      scope: 'openid',
    })
    expect(tokenRes.access_token).toBeTypeOf('string')
    expect(tokenRes.access_token.length).toBeGreaterThan(0)

    const bearerHeaders = new Headers()
    bearerHeaders.set('authorization', `Bearer ${tokenRes.access_token}`)
    const session = await auth.api.getSession({ headers: bearerHeaders })
    expect(session?.user.id).toBe(owner.user?.id)

    const sessionRecord = db.session!.find(
      (r) => r.token === tokenRes.access_token,
    )!
    const oldExpiresAt = new Date(Date.now() + 30_000)
    sessionRecord.expiresAt = oldExpiresAt
    const refreshed = await auth.api.getSession({
      headers: bearerHeaders,
      returnHeaders: true,
    })
    expect(refreshed.response?.user.id).toBe(owner.user?.id)
    expect(refreshed.headers.get('set-auth-token')).toBeTruthy()
    expect(
      new Date(refreshed.response!.session.expiresAt).getTime(),
    ).toBeGreaterThan(oldExpiresAt.getTime())
  })

  test('device token endpoint returns access_denied after the user denies the code', async () => {
    const { auth } = buildAuth()
    const owner = await signUpOwner(auth)

    const code = await auth.api.deviceCode({
      body: { client_id: CLIENT_ID, scope: 'openid' },
    })
    await auth.api.deviceVerify({
      query: { user_code: code.user_code },
      headers: owner.headers,
    })
    await auth.api.deviceDeny({
      body: { userCode: code.user_code },
      headers: owner.headers,
    })

    await expect(
      auth.api.deviceToken({
        body: {
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: code.device_code,
          client_id: CLIENT_ID,
        },
      }),
    ).rejects.toMatchObject({
      body: { error: 'access_denied' },
    })
  })

  test('device token endpoint reports expired_token once the device code expires', async () => {
    const { auth, db } = buildAuth()
    const code = await auth.api.deviceCode({
      body: { client_id: CLIENT_ID },
    })
    const record = db.deviceCode!.find(
      (r) => r.deviceCode === code.device_code,
    )!
    record.expiresAt = new Date(Date.now() - 1000)

    await expect(
      auth.api.deviceToken({
        body: {
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: code.device_code,
          client_id: CLIENT_ID,
        },
      }),
    ).rejects.toMatchObject({
      body: { error: 'expired_token' },
    })
  })

  test('approve fails when caller is not authenticated', async () => {
    const { auth } = buildAuth()
    const code = await auth.api.deviceCode({
      body: { client_id: CLIENT_ID },
    })

    await expect(
      auth.api.deviceApprove({
        body: { userCode: code.user_code },
        headers: new Headers(),
      }),
    ).rejects.toMatchObject({
      body: { error: 'unauthorized' },
    })
  })
})
