import type { ExecutionContext } from '@nestjs/common'
import { BizException } from '~/common/exceptions/biz.exception'
import { AuthGuard } from '~/common/guards/auth.guard'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import type { AuthService } from '~/modules/auth/auth.service'
import type { SessionUser } from '~/modules/auth/auth.types'
import { vi } from 'vitest'

function createMockAuthService(): Record<keyof AuthService, any> {
  return {
    getSessionUser: vi.fn().mockResolvedValue(null),
    getApiKeyFromRequest: vi.fn().mockReturnValue(null),
    isCustomToken: vi.fn().mockReturnValue(false),
    verifyApiKey: vi.fn().mockResolvedValue(null),
    isOwnerReaderId: vi.fn().mockResolvedValue(false),
    getReaderById: vi.fn().mockResolvedValue(null),
  } as any
}

function createMockContext(overrides?: {
  headers?: Record<string, any>
  query?: Record<string, any>
}) {
  const request: any = {
    headers: overrides?.headers ?? {},
    query: overrides?.query ?? {},
    raw: { headers: overrides?.headers ?? {} },
  }
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext
  return { context, request }
}

const ownerUser: SessionUser = {
  id: 'owner-1',
  email: 'owner@test.com',
  name: 'Owner',
  role: 'owner',
}

const readerUser: SessionUser = {
  id: 'reader-1',
  email: 'reader@test.com',
  name: 'Reader',
  role: 'reader',
}

describe('AuthGuard', () => {
  let guard: AuthGuard
  let authService: ReturnType<typeof createMockAuthService>

  beforeEach(() => {
    authService = createMockAuthService()
    guard = new AuthGuard(authService as any)
  })

  describe('session-based auth', () => {
    it('should pass when session user is owner', async () => {
      const { context, request } = createMockContext()
      authService.getSessionUser.mockResolvedValue({
        user: ownerUser,
        session: { token: 'session-tok' },
      })

      const result = await guard.canActivate(context)

      expect(result).toBe(true)
      expect(request.user).toEqual(ownerUser)
      expect(request.token).toBe('session-tok')
    })

    it('should attach user to raw request', async () => {
      const { context, request } = createMockContext()
      authService.getSessionUser.mockResolvedValue({
        user: ownerUser,
        session: { token: 'tok' },
      })

      await guard.canActivate(context)

      expect(request.raw.user).toEqual(ownerUser)
      expect(request.raw.token).toBe('tok')
    })

    it('should use empty string when session token is absent', async () => {
      const { context, request } = createMockContext()
      authService.getSessionUser.mockResolvedValue({
        user: ownerUser,
        session: {},
      })

      await guard.canActivate(context)

      expect(request.token).toBe('')
    })

    it('should fall through to API key when session user is not owner', async () => {
      const { context } = createMockContext()
      authService.getSessionUser.mockResolvedValue({
        user: readerUser,
        session: { token: 'reader-tok' },
      })

      await expect(guard.canActivate(context)).rejects.toThrow(BizException)
    })

    it('should fall through to API key when session is null', async () => {
      const { context } = createMockContext()
      authService.getSessionUser.mockResolvedValue(null)

      await expect(guard.canActivate(context)).rejects.toThrow(BizException)
    })
  })

  describe('API key auth', () => {
    beforeEach(() => {
      authService.getSessionUser.mockResolvedValue(null)
    })

    it('should throw AuthNotLoggedIn when no API key found', async () => {
      const { context } = createMockContext()
      authService.getApiKeyFromRequest.mockReturnValue(null)

      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({ bizCode: ErrorCodeEnum.AuthNotLoggedIn }),
      )
    })

    it('should throw AuthTokenInvalid when token is not custom format', async () => {
      const { context } = createMockContext()
      authService.getApiKeyFromRequest.mockReturnValue({
        key: 'not-custom-token',
        deprecated: false,
      })
      authService.isCustomToken.mockReturnValue(false)

      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({ bizCode: ErrorCodeEnum.AuthTokenInvalid }),
      )
    })

    it('should throw AuthTokenInvalid when verifyApiKey returns null', async () => {
      const { context } = createMockContext()
      authService.getApiKeyFromRequest.mockReturnValue({
        key: 'txo-valid-key',
        deprecated: false,
      })
      authService.isCustomToken.mockReturnValue(true)
      authService.verifyApiKey.mockResolvedValue(null)

      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({ bizCode: ErrorCodeEnum.AuthTokenInvalid }),
      )
    })

    it('should throw AuthTokenInvalid when verifyApiKey has no userId', async () => {
      const { context } = createMockContext()
      authService.getApiKeyFromRequest.mockReturnValue({
        key: 'txo-valid-key',
        deprecated: false,
      })
      authService.isCustomToken.mockReturnValue(true)
      authService.verifyApiKey.mockResolvedValue({})

      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({ bizCode: ErrorCodeEnum.AuthTokenInvalid }),
      )
    })

    it('should throw AuthTokenInvalid when user is not owner', async () => {
      const { context } = createMockContext()
      authService.getApiKeyFromRequest.mockReturnValue({
        key: 'txo-valid-key',
        deprecated: false,
      })
      authService.isCustomToken.mockReturnValue(true)
      authService.verifyApiKey.mockResolvedValue({ userId: 'reader-1' })
      authService.isOwnerReaderId.mockResolvedValue(false)

      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({ bizCode: ErrorCodeEnum.AuthTokenInvalid }),
      )
    })

    it('should throw AuthTokenInvalid when reader not found', async () => {
      const { context } = createMockContext()
      authService.getApiKeyFromRequest.mockReturnValue({
        key: 'txo-valid-key',
        deprecated: false,
      })
      authService.isCustomToken.mockReturnValue(true)
      authService.verifyApiKey.mockResolvedValue({ userId: 'owner-1' })
      authService.isOwnerReaderId.mockResolvedValue(true)
      authService.getReaderById.mockResolvedValue(null)

      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({ bizCode: ErrorCodeEnum.AuthTokenInvalid }),
      )
    })

    it('should pass and attach user when API key is valid owner', async () => {
      const { context, request } = createMockContext()
      const apiKey = 'txo-valid-owner-key'
      authService.getApiKeyFromRequest.mockReturnValue({
        key: apiKey,
        deprecated: false,
      })
      authService.isCustomToken.mockReturnValue(true)
      authService.verifyApiKey.mockResolvedValue({ userId: 'owner-1' })
      authService.isOwnerReaderId.mockResolvedValue(true)
      authService.getReaderById.mockResolvedValue(ownerUser)

      const result = await guard.canActivate(context)

      expect(result).toBe(true)
      expect(request.user).toEqual(ownerUser)
      expect(request.token).toBe(apiKey)
      expect(request.raw.user).toEqual(ownerUser)
      expect(request.raw.token).toBe(apiKey)
    })

    it('should handle deprecated Bearer token', async () => {
      const { context, request } = createMockContext({
        headers: { authorization: 'Bearer txo-deprecated' },
      })
      authService.getApiKeyFromRequest.mockReturnValue({
        key: 'txo-deprecated',
        deprecated: true,
      })
      authService.isCustomToken.mockReturnValue(true)
      authService.verifyApiKey.mockResolvedValue({ userId: 'owner-1' })
      authService.isOwnerReaderId.mockResolvedValue(true)
      authService.getReaderById.mockResolvedValue(ownerUser)

      const result = await guard.canActivate(context)

      expect(result).toBe(true)
      expect(request.user).toEqual(ownerUser)
    })
  })

  describe('session fallback to API key', () => {
    it('should try API key when session exists but user is reader', async () => {
      const { context, request } = createMockContext()
      authService.getSessionUser.mockResolvedValue({
        user: readerUser,
        session: { token: 'reader-tok' },
      })
      const apiKey = 'txo-fallback-key'
      authService.getApiKeyFromRequest.mockReturnValue({
        key: apiKey,
        deprecated: false,
      })
      authService.isCustomToken.mockReturnValue(true)
      authService.verifyApiKey.mockResolvedValue({ userId: 'owner-1' })
      authService.isOwnerReaderId.mockResolvedValue(true)
      authService.getReaderById.mockResolvedValue(ownerUser)

      const result = await guard.canActivate(context)

      expect(result).toBe(true)
      expect(request.user).toEqual(ownerUser)
      expect(request.token).toBe(apiKey)
    })
  })
})
