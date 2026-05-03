import { describe, expect, it, vi } from 'vitest'

import { BizException } from '~/common/exceptions/biz.exception'
import {
  LinkController,
  LinkControllerCrud,
} from '~/modules/link/link.controller'

describe('LinkController', () => {
  it('blocks link applications when the PG-backed service reports disabled audit', async () => {
    const service = {
      canApplyLink: vi.fn().mockResolvedValue(false),
      applyForLink: vi.fn(),
      sendToOwner: vi.fn(),
    }
    const controller = new LinkController(service as any)

    await expect(
      controller.applyForLink({
        url: 'https://example.com',
        name: 'Example',
        author: 'Alice',
      } as any),
    ).rejects.toThrow(BizException)
    expect(service.applyForLink).not.toHaveBeenCalled()
  })

  it('returns approved links with converted avatar metadata', async () => {
    const service = {
      approveLink: vi.fn().mockResolvedValue({
        link: { id: 'link-1', email: null },
        convertedAvatar: 'https://cdn.example/avatar.png',
      }),
      sendToCandidate: vi.fn(),
    }
    const controller = new LinkController(service as any)

    await expect(controller.approveLink('link-1')).resolves.toEqual({
      link: { id: 'link-1', email: null },
      convertedAvatar: 'https://cdn.example/avatar.png',
    })
  })
})

describe('LinkControllerCrud', () => {
  it('hides email fields for anonymous list responses', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue({
        data: [{ id: '1', email: 'owner@example.com' }],
        total: 1,
      }),
    }
    const controller = new LinkControllerCrud(repository as any, {} as any)

    await expect(
      controller.gets({ page: 1, size: 10 } as any, false),
    ).resolves.toEqual({
      data: [{ id: '1', email: null }],
      total: 1,
    })
  })
})
