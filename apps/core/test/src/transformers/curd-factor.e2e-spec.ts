import { describe, expect, it, vi } from 'vitest'

import { BasePgCrudFactory } from '~/transformers/crud-factor.pg.transformer'

class ExampleRepository {
  static name = 'ExampleRepository'

  list = vi.fn()
  findAll = vi.fn()
  findById = vi.fn()
  create = vi.fn()
  update = vi.fn()
  deleteById = vi.fn()
}

describe('BasePgCrudFactory', () => {
  it('routes creates through the injected PG repository and broadcasts events', async () => {
    const Controller = BasePgCrudFactory({
      repository: ExampleRepository as any,
    })
    const repository = new ExampleRepository()
    repository.create.mockResolvedValue({ id: 'row-1' })
    const eventManager = { broadcast: vi.fn() }
    const controller = new Controller(repository, eventManager)

    await expect(controller.create({ title: 'Row' })).resolves.toEqual({
      id: 'row-1',
    })

    expect(repository.create).toHaveBeenCalledWith({ title: 'Row' })
    expect(eventManager.broadcast).toHaveBeenCalledWith(
      'EXAMPLE_CREATE',
      { id: 'row-1' },
      expect.any(Object),
    )
  })

  it('uses repository deleteById for deletes and emits the PG delete event', async () => {
    const Controller = BasePgCrudFactory({
      repository: ExampleRepository as any,
    })
    const repository = new ExampleRepository()
    const eventManager = { broadcast: vi.fn() }
    const controller = new Controller(repository, eventManager)

    await controller.delete({ id: 'row-1' })

    expect(repository.deleteById).toHaveBeenCalledWith('row-1')
    expect(eventManager.broadcast).toHaveBeenCalledWith(
      'EXAMPLE_DELETE',
      { id: 'row-1' },
      expect.any(Object),
    )
  })
})
