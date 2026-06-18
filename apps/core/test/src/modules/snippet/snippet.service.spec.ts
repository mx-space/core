import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { AppException } from '~/common/errors/exception.types'
import type { SnippetRepository } from '~/modules/snippet/snippet.repository'
import { SnippetType } from '~/modules/snippet/snippet.schema'
import { SnippetService } from '~/modules/snippet/snippet.service'
import type { SnippetRow } from '~/modules/snippet/snippet.types'

const createSnippet = (overrides: Partial<SnippetRow> = {}): SnippetRow => ({
  id: '1' as any,
  type: SnippetType.JSON,
  private: false,
  raw: '{"enabled":true}',
  path: 'root/feature-flags.json',
  comment: null,
  metatype: null,
  schema: null,
  method: null,
  secret: null,
  enable: true,
  builtIn: false,
  compiledCode: null,
  createdAt: now,
  updatedAt: null,
  ...overrides,
})

const createService = () => {
  const repository = createPgRepositoryMock<SnippetRepository>()
  const serverlessService = {
    isValidServerlessFunction: vi.fn().mockResolvedValue(true),
    compileTypescriptCode: vi.fn(async (code: string) => `compiled:${code}`),
  }
  const redis = {
    hset: vi.fn(),
    hget: vi.fn(),
    hdel: vi.fn(),
  }
  const redisService = {
    getClient: vi.fn(() => redis),
  }
  const eventManager = {
    emit: vi.fn(),
  }
  const configsService = {
    get: vi.fn().mockResolvedValue({ serverUrl: '' }),
  }

  const service = new SnippetService(
    repository as any,
    serverlessService as any,
    redisService as any,
    eventManager as any,
    configsService as any,
  )

  return { redis, repository, serverlessService, service }
}

describe('SnippetService', () => {
  it('creates JSON snippets through the PG repository with path defaults', async () => {
    const { repository, service } = createService()
    const created = createSnippet()
    repository.countByPathMethod.mockResolvedValue(0)
    repository.create.mockResolvedValue(created)

    await expect(
      service.create({
        raw: '{"enabled":true}',
        path: 'root/feature-flags.json',
      }),
    ).resolves.toEqual(created)

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SnippetType.JSON,
        private: false,
        path: 'root/feature-flags.json',
        raw: '{"enabled":true}',
        secret: null,
      }),
    )
  })

  it('rejects duplicate path/method pairs before writing', async () => {
    const { repository, service } = createService()
    repository.countByPathMethod.mockResolvedValue(1)

    await expect(
      service.create({
        raw: '{}',
        path: 'root/feature-flags.json',
      }),
    ).rejects.toThrow(AppException)

    expect(repository.create).not.toHaveBeenCalled()
  })

  it('compiles function snippets and defaults method to GET', async () => {
    const { repository, serverlessService, service } = createService()
    repository.countByPathMethod.mockResolvedValue(0)
    repository.create.mockResolvedValue(
      createSnippet({
        type: SnippetType.Function,
        path: 'fn/handler',
        raw: 'export default async function handler() {}',
        compiledCode: 'compiled:export default async function handler() {}',
      }),
    )

    await service.create({
      type: SnippetType.Function,
      raw: 'export default async function handler() {}',
      path: 'fn/handler',
    })

    expect(serverlessService.compileTypescriptCode).toHaveBeenCalled()
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        enable: true,
        compiledCode: 'compiled:export default async function handler() {}',
      }),
    )
  })

  it('invalidates public and private path cache keys when deleting a snippet', async () => {
    const { redis, repository, service } = createService()
    repository.findById.mockResolvedValue(createSnippet())
    repository.deleteById.mockResolvedValue(createSnippet())

    await service.delete('1')

    expect(repository.deleteById).toHaveBeenCalledWith('1')
    expect(redis.hdel).toHaveBeenCalledTimes(2)
  })
})
