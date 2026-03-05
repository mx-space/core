import { APIError } from 'better-auth/api'
import { describe, expect, it, vi } from 'vitest'

/**
 * Test the api wrapper created in auth.implement.ts CreateAuth().
 * Since CreateAuth requires MongoDB + full betterAuth, we replicate
 * the wrapping logic here to verify behavior in isolation.
 */
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
