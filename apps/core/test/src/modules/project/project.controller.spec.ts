import { describe, expect, it, vi } from 'vitest'

import type { AppException } from '~/common/errors/exception.types'
import { ProjectController } from '~/modules/project/project.controller'
import type { ProjectRepository } from '~/modules/project/project.repository'

const makeProject = (overrides: Record<string, unknown> = {}) => ({
  id: '8000000000000001001',
  name: 'kami',
  description: 'a personal blog stack',
  previewUrl: null,
  docUrl: null,
  projectUrl: null,
  images: null,
  avatar: null,
  text: null,
  createdAt: new Date('2024-01-01'),
  ...overrides,
})

const createController = (repoOverrides: Partial<ProjectRepository> = {}) => {
  const repository = {
    list: vi.fn(async () => ({
      data: [makeProject()],
      pagination: { total: 1, currentPage: 1, totalPage: 1, size: 10 },
    })),
    findAll: vi.fn(async () => [makeProject()]),
    findById: vi.fn(async () => makeProject()),
    create: vi.fn(async (input: any) => makeProject(input)),
    update: vi.fn(async (_id: string, patch: any) => makeProject(patch)),
    deleteById: vi.fn(async () => makeProject()),
    ...repoOverrides,
  } as unknown as ProjectRepository
  const controller = new ProjectController(repository)
  return { controller, repository }
}

describe('ProjectController', () => {
  it('list wraps rows in withMeta + pagination', async () => {
    const { controller } = createController()
    const res = (await controller.gets({ page: 1, size: 10 } as any)) as any
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data[0].name).toBe('kami')
    expect(res.meta.pagination).toEqual({
      page: 1,
      size: 10,
      total: 1,
      totalPages: 1,
    })
  })

  it('get returns the row when found', async () => {
    const { controller, repository } = createController()
    const res = await controller.get({ id: '8000000000000001001' } as any)
    expect(res.name).toBe('kami')
    expect(repository.findById).toHaveBeenCalledWith('8000000000000001001')
  })

  it('get throws PROJECT_NOT_FOUND when missing', async () => {
    const { controller } = createController({
      findById: vi.fn(async () => null) as any,
    })
    await expect(
      controller.get({ id: '8000000000000001001' } as any),
    ).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    } satisfies Partial<AppException>)
  })

  it('create delegates to repo with body', async () => {
    const { controller, repository } = createController()
    const body = {
      name: 'foo',
      description: 'bar',
    } as any
    const res = await controller.create(body)
    expect(repository.create).toHaveBeenCalledWith(body)
    expect(res.name).toBe('foo')
  })

  it('patch returns the updated row', async () => {
    const { controller, repository } = createController()
    const res = await controller.patch(
      { name: 'renamed' } as any,
      {
        id: '8000000000000001001',
      } as any,
    )
    expect(repository.update).toHaveBeenCalledWith('8000000000000001001', {
      name: 'renamed',
    })
    expect(res.name).toBe('renamed')
  })

  it('patch throws PROJECT_NOT_FOUND when row missing', async () => {
    const { controller } = createController({
      update: vi.fn(async () => null) as any,
    })
    await expect(
      controller.patch(
        { name: 'x' } as any,
        {
          id: '8000000000000001001',
        } as any,
      ),
    ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
  })

  it('update aliases to patch handler', async () => {
    const { controller, repository } = createController()
    await controller.update(
      { name: 'a' } as any,
      {
        id: '8000000000000001001',
      } as any,
    )
    expect(repository.update).toHaveBeenCalledWith('8000000000000001001', {
      name: 'a',
    })
  })

  it('delete returns the removed row', async () => {
    const { controller, repository } = createController()
    const res = await controller.delete({ id: '8000000000000001001' } as any)
    expect(repository.deleteById).toHaveBeenCalledWith('8000000000000001001')
    expect(res.id).toBe('8000000000000001001')
  })

  it('delete throws PROJECT_NOT_FOUND when row missing', async () => {
    const { controller } = createController({
      deleteById: vi.fn(async () => null) as any,
    })
    await expect(
      controller.delete({ id: '8000000000000001001' } as any),
    ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
  })

  it('create propagates PROJECT_NAME_TAKEN when repo rejects', async () => {
    const { AppErrorCode, createAppException } = await import('~/common/errors')
    const { controller } = createController({
      create: vi.fn(async () => {
        throw createAppException(AppErrorCode.PROJECT_NAME_TAKEN, {
          name: 'kami',
        })
      }) as any,
    })
    await expect(
      controller.create({ name: 'kami', description: 'x' } as any),
    ).rejects.toMatchObject({ code: 'PROJECT_NAME_TAKEN' })
  })
})
