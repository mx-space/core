import { describe, expect, it, vi } from 'vitest'

import { AppException } from '~/common/errors/exception.types'
import { SnippetController } from '~/modules/snippet/snippet.controller'
import { SnippetType } from '~/modules/snippet/snippet.schema'

const skillRow = { id: '2', type: SnippetType.Skill }
const jsonRow = { id: '1', type: SnippetType.JSON }

const createController = () => {
  const repository = {
    list: vi.fn().mockResolvedValue({
      data: [jsonRow],
      pagination: {
        currentPage: 1,
        totalPage: 1,
        total: 1,
        size: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
    }),
    listGrouped: vi.fn().mockResolvedValue({
      data: [],
      pagination: {
        currentPage: 1,
        totalPage: 1,
        total: 0,
        size: 30,
        hasNextPage: false,
        hasPrevPage: false,
      },
    }),
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

    const result = await controller.getList({ page: 1, size: 10 } as any)
    expect(result.data).toEqual(['1'])
    expect(result.meta.pagination).toMatchObject({
      page: 1,
      total: 1,
      size: 10,
    })

    expect(service.transformLeanSnippetList).toHaveBeenCalledWith([jsonRow])
  })

  it('passes type=skill to repository.list', async () => {
    const { controller, repository } = createController()
    repository.list.mockResolvedValue({
      data: [skillRow],
      pagination: {
        currentPage: 1,
        totalPage: 1,
        total: 1,
        size: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })

    await controller.getList({
      page: 1,
      size: 10,
      type: SnippetType.Skill,
    } as any)
    expect(repository.list).toHaveBeenCalledWith(1, 10, SnippetType.Skill)
  })

  it('passes type=json to repository.list and excludes Skill rows', async () => {
    const { controller, repository } = createController()
    repository.list.mockResolvedValue({
      data: [jsonRow],
      pagination: {
        currentPage: 1,
        totalPage: 1,
        total: 1,
        size: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })

    const result = await controller.getList({
      page: 1,
      size: 10,
      type: SnippetType.JSON,
    } as any)
    expect(repository.list).toHaveBeenCalledWith(1, 10, SnippetType.JSON)
    expect(result.data.every((r: any) => r !== SnippetType.Skill)).toBe(true)
  })

  it('rejects the removed aggregate endpoint in PG mode', async () => {
    const { controller } = createController()

    await expect(controller.aggregate()).rejects.toThrow(AppException)
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
