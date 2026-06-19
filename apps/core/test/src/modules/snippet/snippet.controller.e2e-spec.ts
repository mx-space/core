import { describe, expect, it, vi } from 'vitest'

import { SnippetController } from '~/modules/snippet/snippet.controller'
import { SnippetType } from '~/modules/snippet/snippet.schema'

const objectRow = { id: '1', path: 'root/config.json', type: SnippetType.JSON }

const createController = () => {
  const repository = {
    findAnyByPath: vi.fn().mockResolvedValue(objectRow),
  }
  const service = {
    repository,
    listVfs: vi.fn().mockResolvedValue({
      prefix: '',
      objects: [objectRow],
      commonPrefixes: ['root/'],
    }),
    transformLeanSnippet: vi.fn((row) => row),
    create: vi.fn().mockResolvedValue(objectRow),
    upsertByPath: vi.fn().mockResolvedValue(objectRow),
    importSnippets: vi.fn().mockResolvedValue({
      created: 1,
      updated: 0,
      snippets: [objectRow],
    }),
    getSnippetById: vi.fn().mockResolvedValue(objectRow),
    update: vi.fn().mockResolvedValue(objectRow),
    delete: vi.fn(),
    deleteByPath: vi.fn(),
    movePath: vi.fn().mockResolvedValue([objectRow]),
  }
  return {
    controller: new SnippetController(service as any),
    repository,
    service,
  }
}

describe('SnippetController', () => {
  it('returns VFS listing options from GET /snippets', async () => {
    const { controller, service } = createController()

    const result = await controller.getList({
      prefix: 'sk/',
      recursive: true,
      limit: 100,
    } as any)

    expect(result.objects).toEqual([objectRow])
    expect(service.listVfs).toHaveBeenCalledWith({
      prefix: 'sk/',
      recursive: true,
      limit: 100,
    })
  })

  it('reads a single object by path', async () => {
    const { controller, repository } = createController()

    const result = await controller.getSnippetByPath({
      path: 'root/config.json',
    } as any)

    expect(result).toEqual(objectRow)
    expect(repository.findAnyByPath).toHaveBeenCalledWith('root/config.json')
  })

  it('upserts by path', async () => {
    const { controller, service } = createController()

    await controller.upsertByPath({
      path: 'root/config.json',
      raw: '{}',
      type: SnippetType.JSON,
    } as any)

    expect(service.upsertByPath).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'root/config.json' }),
    )
  })

  it('deletes and moves paths through service operations', async () => {
    const { controller, service } = createController()

    await controller.deleteByPath({
      path: 'sk/foo/',
      recursive: true,
    } as any)
    await controller.move({
      from: 'sk/foo/',
      to: 'sk/bar/',
      recursive: true,
    } as any)

    expect(service.deleteByPath).toHaveBeenCalledWith('sk/foo/', true)
    expect(service.movePath).toHaveBeenCalledWith('sk/foo/', 'sk/bar/', true)
  })

  it('returns transactional import totals from POST /snippets/import', async () => {
    const { controller, service } = createController()

    const body = {
      snippets: [
        { path: 'root/config.json', raw: '{}', type: SnippetType.JSON },
      ],
    }
    const result = await controller.importSnippets(body as any)

    expect(service.importSnippets).toHaveBeenCalledWith(body.snippets)
    expect(result).toEqual({
      created: 1,
      updated: 0,
      snippets: [objectRow],
    })
  })
})
