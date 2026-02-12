import type { ExecutionContext } from '@nestjs/common'
import { RolesGuard } from '~/common/guards/roles.guard'
import type { SessionUser } from '~/modules/auth/auth.types'
import type { ConfigsService } from '~/modules/configs/configs.service'
import { vi } from 'vitest'

function createMockAuthService(): Record<string, any> {
  return {
    getSessionUser: vi.fn().mockResolvedValue(null),
    getApiKeyFromRequest: vi.fn().mockReturnValue(null),
    isCustomToken: vi.fn().mockReturnValue(false),
    verifyApiKey: vi.fn().mockResolvedValue(null),
    isOwnerReaderId: vi.fn().mockResolvedValue(false),
    getReaderById: vi.fn().mockResolvedValue(null),
  }
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

describe('RolesGuard', () => {
  let guard: RolesGuard
  let authService: ReturnType<typeof createMockAuthService>
  const configsService = {} as ConfigsService

  beforeEach(() => {
    authService = createMockAuthService()
    guard = new RolesGuard(authService as any, configsService)
  })

  it('should always return true', async () => {
    const { context } = createMockContext()
    const result = await guard.canActivate(context)
    expect(result).toBe(true)
  })

  it('should set isAuthenticated=true when owner session exists', async () => {
    const { context, request } = createMockContext()
    authService.getSessionUser.mockResolvedValue({
      user: ownerUser,
      session: { token: 'tok' },
    })

    await guard.canActivate(context)

    expect(request.isAuthenticated).toBe(true)
    expect(request.isGuest).toBe(false)
    expect(request.raw.isAuthenticated).toBe(true)
    expect(request.raw.isGuest).toBe(false)
  })

  it('should set isAuthenticated=false when no session', async () => {
    const { context, request } = createMockContext()
    authService.getSessionUser.mockResolvedValue(null)

    await guard.canActivate(context)

    expect(request.isAuthenticated).toBe(false)
    expect(request.isGuest).toBe(true)
    expect(request.raw.isAuthenticated).toBe(false)
    expect(request.raw.isGuest).toBe(true)
  })

  it('should set isAuthenticated=false when session is reader (non-owner)', async () => {
    const { context, request } = createMockContext()
    authService.getSessionUser.mockResolvedValue({
      user: readerUser,
      session: { token: 'reader-tok' },
    })

    await guard.canActivate(context)

    expect(request.isAuthenticated).toBe(false)
    expect(request.isGuest).toBe(true)
  })

  it('should set readerId from session user', async () => {
    const { context, request } = createMockContext()
    authService.getSessionUser.mockResolvedValue({
      user: { id: 'reader-42', role: 'reader' },
      session: { token: 'tok' },
    })

    await guard.canActivate(context)

    expect(request.readerId).toBe('reader-42')
    expect(request.raw.readerId).toBe('reader-42')
  })

  it('should set readerId from request.user when session has no user id', async () => {
    const { context, request } = createMockContext()
    // First call (from super.canActivate) → owner session for isAuthenticated
    // Second call (from this.canActivate) → null to test fallback
    authService.getSessionUser
      .mockResolvedValueOnce({
        user: ownerUser,
        session: { token: 'tok' },
      })
      .mockResolvedValueOnce(null)

    await guard.canActivate(context)

    // readerId fallback to request.user.id (set by super.canActivate)
    expect(request.readerId).toBe('owner-1')
  })

  it('should not set readerId when no session and no user', async () => {
    const { context, request } = createMockContext()
    authService.getSessionUser.mockResolvedValue(null)

    await guard.canActivate(context)

    expect(request.readerId).toBeUndefined()
  })

  it('should set isAuthenticated=true via API key when no session', async () => {
    const { context, request } = createMockContext()

    // First getSessionUser call (super.canActivate) → null
    // getApiKeyFromRequest returns valid key, which makes super.canActivate pass
    authService.getSessionUser.mockResolvedValue(null)
    authService.getApiKeyFromRequest.mockReturnValue({
      key: 'txo-valid',
      deprecated: false,
    })
    authService.isCustomToken.mockReturnValue(true)
    authService.verifyApiKey.mockResolvedValue({ userId: 'owner-1' })
    authService.isOwnerReaderId.mockResolvedValue(true)
    authService.getReaderById.mockResolvedValue(ownerUser)

    await guard.canActivate(context)

    expect(request.isAuthenticated).toBe(true)
    expect(request.isGuest).toBe(false)
  })

  it('should not throw when super.canActivate fails but getSessionUser succeeds', async () => {
    const { context, request } = createMockContext()
    // First call (inside super.canActivate) throws, caught by try-catch
    // Second call (inside this.canActivate) returns null
    authService.getSessionUser
      .mockRejectedValueOnce(new Error('DB down'))
      .mockResolvedValueOnce(null)

    const result = await guard.canActivate(context)

    expect(result).toBe(true)
    expect(request.isAuthenticated).toBe(false)
    expect(request.isGuest).toBe(true)
  })
})
