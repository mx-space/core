import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { BizException } from '~/common/exceptions/biz.exception'
import type {
  SnippetRepository,
  SnippetRow,
} from '~/modules/snippet/snippet.repository'
import { SnippetType } from '~/modules/snippet/snippet.schema'
import { SnippetService } from '~/modules/snippet/snippet.service'

const createSnippet = (overrides: Partial<SnippetRow> = {}): SnippetRow => ({
  id: '1' as any,
  type: SnippetType.JSON,
  private: false,
  raw: '{"enabled":true}',
  name: 'feature-flags',
  reference: 'root',
  comment: null,
  metatype: null,
  schema: null,
  method: null,
  customPath: null,
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

  const service = new SnippetService(
    repository as any,
    serverlessService as any,
    redisService as any,
    eventManager as any,
  )

  return { eventManager, redis, repository, serverlessService, service }
}

describe('SnippetService', () => {
  it('creates JSON snippets through the PG repository with normalized defaults', async () => {
    const { repository, service } = createService()
    const created = createSnippet()
    repository.countByNameReferenceMethod.mockResolvedValue(0)
    repository.create.mockResolvedValue(created)

    await expect(
      service.create({
        raw: '{"enabled":true}',
        name: 'feature-flags',
      }),
    ).resolves.toEqual(created)

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SnippetType.JSON,
        private: false,
        reference: 'root',
        raw: '{"enabled":true}',
        secret: null,
      }),
    )
  })

  it('rejects duplicate snippets before writing to the PG repository', async () => {
    const { repository, service } = createService()
    repository.countByNameReferenceMethod.mockResolvedValue(1)

    await expect(
      service.create({
        raw: '{}',
        name: 'feature-flags',
      }),
    ).rejects.toThrow(BizException)

    expect(repository.create).not.toHaveBeenCalled()
  })

  it('compiles function snippets and rejects reserved references', async () => {
    const { repository, serverlessService, service } = createService()
    repository.countByNameReferenceMethod.mockResolvedValue(0)

    await expect(
      service.create({
        type: SnippetType.Function,
        raw: 'export default async function handler() {}',
        name: 'handler',
        reference: 'system',
      }),
    ).rejects.toThrow(BizException)

    repository.create.mockResolvedValue(
      createSnippet({
        type: SnippetType.Function,
        name: 'handler',
        raw: 'export default async function handler() {}',
        compiledCode: 'compiled:export default async function handler() {}',
      }),
    )

    await service.create({
      type: SnippetType.Function,
      raw: 'export default async function handler() {}',
      name: 'handler',
      reference: 'root',
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

  it('invalidates name and custom-path caches when deleting a snippet', async () => {
    const { redis, repository, service } = createService()
    repository.findById.mockResolvedValue(
      createSnippet({ customPath: '/api/example' }),
    )
    repository.deleteById.mockResolvedValue(createSnippet())

    await service.delete('1')

    expect(repository.deleteById).toHaveBeenCalledWith('1')
    expect(redis.hdel).toHaveBeenCalledTimes(4)
  })
})
