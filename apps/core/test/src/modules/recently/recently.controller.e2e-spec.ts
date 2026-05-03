import { describe, expect, it, vi } from 'vitest'

import { BizException } from '~/common/exceptions/biz.exception'
import { RecentlyController } from '~/modules/recently/recently.controller'

const createController = () => {
  const service = {
    getLatestOne: vi.fn().mockResolvedValue({ id: 'latest' }),
    getAll: vi.fn().mockResolvedValue([]),
    getOffset: vi.fn().mockResolvedValue({ data: [] }),
    getOne: vi.fn().mockResolvedValue({ id: 'recent-1' }),
    create: vi.fn().mockResolvedValue({ id: 'recent-1' }),
    delete: vi.fn().mockResolvedValue(true),
    update: vi.fn().mockResolvedValue({ id: 'recent-1' }),
    updateAttitude: vi.fn().mockResolvedValue(1),
  }
  return { controller: new RecentlyController(service as any), service }
}

describe('RecentlyController', () => {
  it('rejects ambiguous offset pagination boundaries', async () => {
    const { controller, service } = createController()

    await expect(
      controller.getList({ before: 'b', after: 'a', size: 10 } as any),
    ).rejects.toThrow(BizException)
    expect(service.getOffset).not.toHaveBeenCalled()
  })

  it('delegates attitude updates with the caller ip address', async () => {
    const { controller, service } = createController()

    await expect(
      controller.attitude(
        { id: 'recent-1' } as any,
        { attitude: 'like' } as any,
        { ip: '127.0.0.1' } as any,
      ),
    ).resolves.toEqual({ code: 1 })

    expect(service.updateAttitude).toHaveBeenCalledWith({
      id: 'recent-1',
      attitude: 'like',
      ip: '127.0.0.1',
    })
  })
})
