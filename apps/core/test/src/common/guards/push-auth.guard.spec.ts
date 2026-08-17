import type { ExecutionContext } from '@nestjs/common'
import { vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { AppException } from '~/common/errors/exception.types'
import { PushAuthGuard } from '~/common/guards/push-auth.guard'
import type { AuthService } from '~/modules/auth/auth.service'
import type { SessionUser } from '~/modules/auth/auth.types'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

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

function createMockContext() {
  const request: any = {
    headers: {},
    query: {},
    raw: { headers: {} },
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

describe('PushAuthGuard', () => {
  let guard: PushAuthGuard
  let authService: ReturnType<typeof createMockAuthService>

  beforeEach(() => {
    authService = createMockAuthService()
    guard = new PushAuthGuard(authService as any)
  })

  it('accepts a normal reader Better Auth session and attaches CurrentUser fields', async () => {
    const { context, request } = createMockContext()
    authService.getSessionUser.mockResolvedValue({
      user: readerUser,
      session: { token: 'reader-tok' },
    })

    await expect(guard.canActivate(context)).resolves.toBe(true)

    const attached = getNestExecutionContextRequest(context).user
    expect(attached).toEqual(readerUser)
    expect(request.user).toEqual(readerUser)
    expect(request.readerId).toBe('reader-1')
    expect(request.token).toBe('reader-tok')
    expect(request.isAuthenticated).toBe(true)
    expect(request.hasReaderIdentity).toBe(true)
    expect(request.hasAdminAccess).toBe(false)
    expect(request.raw.user).toEqual(readerUser)
    expect(request.raw.readerId).toBe('reader-1')
    expect(authService.getApiKeyFromRequest).not.toHaveBeenCalled()
  })

  it('accepts an owner Better Auth session without requiring an API key', async () => {
    const { context, request } = createMockContext()
    authService.getSessionUser.mockResolvedValue({
      user: ownerUser,
      session: { token: 'owner-tok' },
    })

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(getNestExecutionContextRequest(context).user).toEqual(ownerUser)
    expect(request.readerId).toBe('owner-1')
    expect(request.hasAdminAccess).toBe(true)
    expect(authService.verifyApiKey).not.toHaveBeenCalled()
  })

  it('accepts a valid owner API key when no session is present', async () => {
    const { context, request } = createMockContext()
    const apiKey = 'txo-valid-owner-key'
    authService.getApiKeyFromRequest.mockReturnValue({ key: apiKey })
    authService.verifyApiKey.mockResolvedValue({ referenceId: 'owner-1' })
    authService.getReaderById.mockResolvedValue(ownerUser)

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(getNestExecutionContextRequest(context).user).toEqual(ownerUser)
    expect(request.token).toBe(apiKey)
    expect(request.readerId).toBe('owner-1')
    expect(request.hasReaderIdentity).toBe(true)
    expect(request.hasAdminAccess).toBe(true)
  })

  it('rejects anonymous requests and invalid API keys', async () => {
    const anonymous = createMockContext()
    await expect(guard.canActivate(anonymous.context)).rejects.toThrow(
      expect.objectContaining({ code: AppErrorCode.AUTH_NOT_LOGGED_IN }),
    )

    const invalid = createMockContext()
    authService.getApiKeyFromRequest.mockReturnValue({ key: 'bad-key' })
    authService.verifyApiKey.mockResolvedValue(null)
    await expect(guard.canActivate(invalid.context)).rejects.toThrow(
      expect.objectContaining({ code: AppErrorCode.AUTH_TOKEN_INVALID }),
    )
    await expect(guard.canActivate(invalid.context)).rejects.toBeInstanceOf(
      AppException,
    )
  })

  it('rejects a non-owner API key after a missing session', async () => {
    const { context } = createMockContext()
    authService.getApiKeyFromRequest.mockReturnValue({ key: 'txo-reader-key' })
    authService.verifyApiKey.mockResolvedValue({ referenceId: 'reader-1' })
    authService.getReaderById.mockResolvedValue(readerUser)

    await expect(guard.canActivate(context)).rejects.toThrow(
      expect.objectContaining({ code: AppErrorCode.AUTH_TOKEN_INVALID }),
    )
  })
})
