import type { ExecutionContext } from '@nestjs/common'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { vi } from 'vitest'

import { PushAuthGuard } from '~/common/guards/push-auth.guard'
import type { AuthService } from '~/modules/auth/auth.service'
import { PushController } from '~/modules/push/push.controller'
import type { PushService } from '~/modules/push/push.service'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

describe('PushController auth wiring', () => {
  it('applies PushAuthGuard with OR semantics instead of owner-only AuthGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, PushController)
    expect(guards).toEqual([PushAuthGuard])
  })

  it('exposes the attached reader through CurrentUser after the guard accepts a session', async () => {
    const authService = {
      getSessionUser: vi.fn().mockResolvedValue({
        user: {
          id: 'reader-1',
          email: 'reader@test.com',
          name: 'Reader',
          role: 'reader',
        },
        session: { token: 'reader-tok' },
      }),
      getApiKeyFromRequest: vi.fn(),
      verifyApiKey: vi.fn(),
      getReaderById: vi.fn(),
    }
    const request: Record<string, unknown> = {
      headers: {},
      raw: { headers: {} },
    }
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext
    const guard = new PushAuthGuard(authService as unknown as AuthService)
    const service = {
      status: vi.fn().mockResolvedValue({ enabled: true }),
    }
    const controller = new PushController(service as unknown as PushService)

    await expect(guard.canActivate(context)).resolves.toBe(true)
    const currentUser = getNestExecutionContextRequest(context).user
    expect(currentUser).toMatchObject({ id: 'reader-1', role: 'reader' })

    await controller.status(currentUser!)
    expect(service.status).toHaveBeenCalledWith('reader-1')
  })
})
