import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { UserController } from '~/controllers'
import camelcaseKeys from 'camelcase-keys'

describe('test owner client', () => {
  const client = mockRequestInstance(UserController)

  test('GET /owner', async () => {
    const mocked = mockResponse('/owner', {
      id: '5ea4fe632507ba128f4c938c',
      introduce: '这是我的小世界呀',
      mail: 'i@innei.ren',
      url: 'https://innei.in',
      name: 'Innei',
      social_ids: {
        bili_id: 26578164,
        netease_id: 84302804,
        github: 'Innei',
      },
      username: 'Innei',
      created: '2020-04-26T03:22:11.784Z',
      modified: '2020-11-13T09:38:49.014Z',
      last_login_time: '2021-11-17T13:42:48.209Z',
      avatar: 'https://cdn.innei.ren/avatar.png',
    })
    const data = await client.owner.getOwnerInfo()
    expect(data.id).toEqual(mocked.id)
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
    expect(data.$raw.data).toEqual(mocked)
  })

  test('POST /auth/sign-in/username', async () => {
    const mocked = mockResponse(
      '/auth/sign-in/username',
      {
        token: 'txo123',
        user: {
          id: '5ea4fe632507ba128f4c938c',
        },
      },
      'post',
      {
        username: 'test',
        password: 'test',
      },
    )
    const data = await client.owner.login('test', 'test')
    expect(data.token).toEqual(mocked.token)
    expect(data.$raw.data).toEqual(mocked)
  })

  test('GET /owner/check_logged', async () => {
    const mocked = mockResponse('/owner/check_logged?token=token', {
      isGuest: true,
      ok: 0,
    })
    const data = await client.owner.checkTokenValid('bearer token')
    expect(data).toEqual(mocked)
  })

  test('GET /owner/check_logged without token', async () => {
    const mocked = mockResponse('/owner/check_logged', {
      isGuest: true,
      ok: 0,
    })
    const data = await client.owner.checkTokenValid()
    expect(data).toEqual(mocked)
  })

  test('GET /owner/allow-login', async () => {
    const mocked = mockResponse('/owner/allow-login', {
      password: true,
      passkey: false,
      github: true,
      google: false,
    })
    const data = await client.owner.getAllowLoginMethods()
    expect(data).toEqual(mocked)
  })

  test('GET /auth/session', async () => {
    const mocked = mockResponse('/auth/session', {
      id: 'owner-id',
      provider: 'github',
      provider_account_id: 'github-id',
      role: 'owner',
    })
    const data = await client.owner.getSession()
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
  })

  test('GET /auth/get-session', async () => {
    const mocked = mockResponse('/auth/get-session', {
      session: {
        token: 'session-token',
        user_id: 'owner-id',
        expires_at: '2026-02-08T00:00:00.000Z',
        created_at: '2026-02-08T00:00:00.000Z',
        updated_at: '2026-02-08T00:00:00.000Z',
      },
      user: {
        id: 'owner-id',
      },
    })
    const data = await client.owner.getAuthSession()
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
  })

  test('GET /auth/providers', async () => {
    const mocked = mockResponse('/auth/providers', ['github'])
    const data = await client.owner.getProviders()
    expect(data).toEqual(mocked)
  })

  test('GET /auth/list-sessions', async () => {
    const mocked = mockResponse('/auth/list-sessions', [
      {
        token: 'session-token',
        user_id: 'owner-id',
        expires_at: '2026-02-08T00:00:00.000Z',
        created_at: '2026-02-08T00:00:00.000Z',
        updated_at: '2026-02-08T00:00:00.000Z',
      },
    ])
    const data = await client.owner.listSessions()
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
  })

  test('POST /auth/revoke-session', async () => {
    const mocked = mockResponse(
      '/auth/revoke-session',
      { status: true },
      'post',
      { token: 'session-token' },
    )
    const data = await client.owner.revokeSession('session-token')
    expect(data).toEqual(mocked)
  })

  test('POST /auth/revoke-sessions', async () => {
    const mocked = mockResponse(
      '/auth/revoke-sessions',
      { status: true },
      'post',
    )
    const data = await client.owner.revokeSessions()
    expect(data).toEqual(mocked)
  })

  test('POST /auth/revoke-other-sessions', async () => {
    const mocked = mockResponse(
      '/auth/revoke-other-sessions',
      { status: true },
      'post',
    )
    const data = await client.owner.revokeOtherSessions()
    expect(data).toEqual(mocked)
  })

  test('POST /auth/sign-out', async () => {
    const mocked = mockResponse('/auth/sign-out', { success: true }, 'post')
    const data = await client.owner.logout()
    expect(data).toEqual(mocked)
  })

  it('should inject owner client work', () => {
    expect(client.owner.getOwnerInfo).toBeInstanceOf(Function)
  })
})
