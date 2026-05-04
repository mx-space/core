import { describe, expect, it, vi } from 'vitest'

import { BizException } from '~/common/exceptions/biz.exception'
import { SnippetController } from '~/modules/snippet/snippet.controller'

const createController = () => {
  const repository = {
    list: vi.fn().mockResolvedValue({ data: [{ id: '1' }], total: 1 }),
    listGrouped: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findAll: vi.fn().mockResolvedValue([{ id: '1' }]),
  }
  const service = {
    repository,
    transformLeanSnippetList: vi.fn((rows) => rows.map((row: any) => row.id)),
    create: vi.fn().mockResolvedValue({ id: '1' }),
    getSnippetById: vi.fn().mockResolvedValue({ id: '1' }),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn(),
    getCachedSnippet: vi.fn(),
    getPublicSnippetByName: vi.fn().mockResolvedValue({ enabled: true }),
  }
  return {
    controller: new SnippetController(service as any),
    repository,
    service,
  }
}

describe('SnippetController', () => {
  it('maps PG repository list rows through the service transformer', async () => {
    const { controller, service } = createController()

    await expect(
      controller.getList({ page: 1, size: 10 } as any),
    ).resolves.toEqual({
      data: ['1'],
      total: 1,
    })

    expect(service.transformLeanSnippetList).toHaveBeenCalledWith([{ id: '1' }])
  })

  it('rejects the removed aggregate endpoint in PG mode', async () => {
    const { controller } = createController()

    await expect(controller.aggregate()).rejects.toThrow(BizException)
  })

  it('uses public snippet lookup when cache misses', async () => {
    const { controller, service } = createController()

    await expect(
      controller.getSnippetByName('feature-flags', 'root', false),
    ).resolves.toEqual({ enabled: true })

    expect(service.getPublicSnippetByName).toHaveBeenCalledWith(
      'feature-flags',
      'root',
    )
  })
})
