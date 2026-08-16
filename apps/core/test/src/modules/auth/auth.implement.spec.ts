import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { APIError } from 'better-auth/api'
import { username } from 'better-auth/plugins'
import { describe, expect, it, vi } from 'vitest'

import {
  assertUserDeletionAllowed,
  createCredentialSignInHook,
  reviewDemoDatabaseHooks,
} from '~/modules/auth/auth.implement'
import { validateMxUsername } from '~/modules/auth/auth.username-validator'
import type { CredentialSignInGate } from '~/modules/auth/email-sign-in-gate'
import {
  REVIEW_DEMO_EMAIL,
  REVIEW_DEMO_HANDLE,
} from '~/modules/auth/review-demo.constants'

const TEST_PASSWORD = 'strong-password-1'

function createApiWrapper(mockApi: Record<string, any>) {
  const _listUserAccounts = mockApi.listUserAccounts.bind(mockApi)
  return Object.assign(mockApi, {
    getProviders(socialProviders: Record<string, any>) {
      return Object.keys(socialProviders || {})
    },
    async listUserAccounts(params: any) {
      try {
        return await _listUserAccounts(params)
      } catch (error) {
        if (error instanceof APIError) {
          return null
        }
        throw error
      }
    },
  })
}

function buildCredentialAuth(
  getCredentialSignInGate: () => Promise<CredentialSignInGate>,
) {
  const database: Record<string, any[]> = {
    account: [],
    session: [],
    user: [],
    verification: [],
  }
  return betterAuth({
    appName: 'mx-core-test',
    basePath: '/auth',
    baseURL: 'http://localhost',
    database: memoryAdapter(database),
    databaseHooks: reviewDemoDatabaseHooks,
    emailAndPassword: { disableSignUp: false, enabled: true },
    hooks: { before: createCredentialSignInHook(getCredentialSignInGate) },
    plugins: [username({ usernameValidator: validateMxUsername })],
    secret: 'test-secret-test-secret-test-secret-12345',
    telemetry: { enabled: false },
    user: {
      additionalFields: {
        handle: { defaultValue: '', type: 'string' },
        role: { defaultValue: 'reader', input: false, type: 'string' },
      },
      deleteUser: {
        beforeDelete: async (user) => assertUserDeletionAllowed(user),
        enabled: true,
      },
    },
  })
}

async function signUp(
  auth: ReturnType<typeof buildCredentialAuth>,
  input: { email: string; name: string; username: string },
) {
  return auth.api.signUpEmail({
    body: { ...input, password: TEST_PASSWORD },
    returnHeaders: true,
  })
}

async function postAuth(
  auth: ReturnType<typeof buildCredentialAuth>,
  path: string,
  body: Record<string, unknown>,
  cookie?: string | null,
) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (cookie) headers.set('cookie', cookie)
  return auth.handler(
    new Request(`http://localhost/auth${path}`, {
      body: JSON.stringify(body),
      headers,
      method: 'POST',
    }),
  )
}

describe('auth.implement api wrapper', () => {
  describe('listUserAccounts', () => {
    it('should not cause infinite recursion', async () => {
      const original = vi.fn().mockResolvedValue([{ id: '1' }])
      const api = createApiWrapper({ listUserAccounts: original })

      const result = await api.listUserAccounts({ headers: new Headers() })

      expect(result).toEqual([{ id: '1' }])
      expect(original).toHaveBeenCalledTimes(1)
    })

    it('should swallow APIError and return null', async () => {
      const original = vi
        .fn()
        .mockRejectedValue(new APIError('NOT_FOUND', { message: 'not found' }))
      const api = createApiWrapper({ listUserAccounts: original })

      const result = await api.listUserAccounts({ headers: new Headers() })

      expect(result).toBeNull()
    })

    it('should rethrow non-APIError', async () => {
      const original = vi.fn().mockRejectedValue(new Error('db down'))
      const api = createApiWrapper({ listUserAccounts: original })

      await expect(
        api.listUserAccounts({ headers: new Headers() }),
      ).rejects.toThrow('db down')
    })

    it('should call original with correct params', async () => {
      const original = vi.fn().mockResolvedValue([])
      const api = createApiWrapper({ listUserAccounts: original })
      const params = { headers: new Headers({ cookie: 'session=abc' }) }

      await api.listUserAccounts(params)

      expect(original).toHaveBeenCalledWith(params)
    })
  })

  describe('getProviders', () => {
    it('should return provider keys', () => {
      const api = createApiWrapper({ listUserAccounts: vi.fn() })

      expect(api.getProviders({ github: {}, google: {} })).toEqual([
        'github',
        'google',
      ])
    })

    it('should return empty array when no providers', () => {
      const api = createApiWrapper({ listUserAccounts: vi.fn() })

      expect(api.getProviders({})).toEqual([])
    })
  })
})

describe('credential auth endpoints', () => {
  it('enforces every email and username gate combination through Better Auth', async () => {
    let gate: CredentialSignInGate = {
      disablePasswordLogin: false,
      reviewDemoBanned: false,
      reviewDemoEnabled: true,
    }
    const auth = buildCredentialAuth(async () => gate)
    await signUp(auth, {
      email: REVIEW_DEMO_EMAIL,
      name: 'App Reviewer',
      username: REVIEW_DEMO_HANDLE,
    })
    await signUp(auth, {
      email: 'owner@example.com',
      name: 'Owner',
      username: 'owner',
    })

    for (const disablePasswordLogin of [false, true]) {
      for (const reviewDemoEnabled of [false, true]) {
        for (const reviewDemoBanned of [false, true]) {
          gate = {
            disablePasswordLogin,
            reviewDemoBanned,
            reviewDemoEnabled,
          }
          const demoEmail = await postAuth(auth, '/sign-in/email', {
            email: REVIEW_DEMO_EMAIL,
            password: TEST_PASSWORD,
          })
          const demoUsername = await postAuth(auth, '/sign-in/username', {
            password: TEST_PASSWORD,
            username: REVIEW_DEMO_HANDLE,
          })
          const ownerEmail = await postAuth(auth, '/sign-in/email', {
            email: 'owner@example.com',
            password: TEST_PASSWORD,
          })
          const ownerUsername = await postAuth(auth, '/sign-in/username', {
            password: TEST_PASSWORD,
            username: 'owner',
          })

          expect(demoEmail.status).toBe(
            reviewDemoEnabled && !reviewDemoBanned ? 200 : 401,
          )
          expect(demoUsername.status).toBe(
            !disablePasswordLogin && reviewDemoEnabled && !reviewDemoBanned
              ? 200
              : 401,
          )
          expect(ownerEmail.status).toBe(disablePasswordLogin ? 401 : 200)
          expect(ownerUsername.status).toBe(disablePasswordLogin ? 401 : 200)
        }
      }
    }
  })

  it('rejects deleting the reserved demo account', async () => {
    const auth = buildCredentialAuth(async () => ({
      disablePasswordLogin: false,
      reviewDemoBanned: false,
      reviewDemoEnabled: true,
    }))
    const created = await signUp(auth, {
      email: REVIEW_DEMO_EMAIL,
      name: 'App Reviewer',
      username: REVIEW_DEMO_HANDLE,
    })

    const response = await postAuth(
      auth,
      '/delete-user',
      { password: TEST_PASSWORD },
      created.headers.get('set-cookie'),
    )

    expect(response.status).toBe(403)
  })

  it('rejects changing the reserved demo password', async () => {
    const auth = buildCredentialAuth(async () => ({
      disablePasswordLogin: false,
      reviewDemoBanned: false,
      reviewDemoEnabled: true,
    }))
    const created = await signUp(auth, {
      email: REVIEW_DEMO_EMAIL,
      name: 'App Reviewer',
      username: REVIEW_DEMO_HANDLE,
    })

    const response = await postAuth(
      auth,
      '/change-password',
      {
        currentPassword: TEST_PASSWORD,
        newPassword: 'different-password-2',
      },
      created.headers.get('set-cookie'),
    )

    expect(response.status).toBe(403)
  })

  it('allows profile updates but rejects reserved identity updates', async () => {
    const auth = buildCredentialAuth(async () => ({
      disablePasswordLogin: false,
      reviewDemoBanned: false,
      reviewDemoEnabled: true,
    }))
    const created = await signUp(auth, {
      email: REVIEW_DEMO_EMAIL,
      name: 'App Reviewer',
      username: REVIEW_DEMO_HANDLE,
    })
    const cookie = created.headers.get('set-cookie')

    const profileResponse = await postAuth(
      auth,
      '/update-user',
      { image: 'https://example.com/reviewer.png', name: 'Reviewer' },
      cookie,
    )
    const handleResponse = await postAuth(
      auth,
      '/update-user',
      { handle: 'changed', name: 'Reviewer' },
      cookie,
    )
    const usernameResponse = await postAuth(
      auth,
      '/update-user',
      { name: 'Reviewer', username: 'changed' },
      cookie,
    )
    const emailResponse = await postAuth(
      auth,
      '/update-user',
      { email: 'changed@example.com', name: 'Reviewer' },
      cookie,
    )
    const roleResponse = await postAuth(
      auth,
      '/update-user',
      { name: 'Reviewer', role: 'owner' },
      cookie,
    )
    const idResponse = await postAuth(
      auth,
      '/update-user',
      { id: 'changed-id', name: 'Reviewer' },
      cookie,
    )

    expect(profileResponse.status).toBe(200)
    expect(handleResponse.status).toBe(403)
    expect(usernameResponse.status).toBe(403)
    expect(emailResponse.status).toBe(400)
    expect(roleResponse.status).toBe(403)
    expect(idResponse.status).toBe(403)
  })
})
