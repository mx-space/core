import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PageProxyController } from '~/modules/pageproxy/pageproxy.controller'

vi.mock('~/constants/path.constant', () => ({
  resolveAdminAssetRoot: vi.fn(() => '/admin'),
}))

describe('PageProxyController.proxyAssetRoute', () => {
  const createReply = () => {
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      callNotFound: vi.fn().mockReturnThis(),
      sent: false,
    }

    return reply
  }

  let controller: PageProxyController

  beforeEach(() => {
    controller = new PageProxyController(
      {
        checkCanAccessAdminProxy: vi.fn().mockResolvedValue(true),
      } as any,
      {} as any,
      {} as any,
    )
  })

  it('returns 403 for traversal attempts before touching asset files', async () => {
    const reply = createReply()

    await controller.proxyAssetRoute(
      {
        url: '/proxy/../../etc/passwd',
      } as any,
      reply as any,
    )

    expect(reply.code).toHaveBeenCalledWith(403)
    expect(reply.send).toHaveBeenCalledWith({
      message: 'path traversal denied',
    })
  })
})
