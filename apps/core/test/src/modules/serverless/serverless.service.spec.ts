import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock } from '@/helper/pg-repository-mock'
import type {
  ServerlessLogRepository,
  ServerlessStorageRepository,
} from '~/modules/serverless/serverless.repository'
import { ServerlessService } from '~/modules/serverless/serverless.service'
import type { SnippetRepository } from '~/modules/snippet/snippet.repository'
import { SnippetType } from '~/modules/snippet/snippet.schema'

const createService = () => {
  const snippetRepository = createPgRepositoryMock<SnippetRepository>()
  const storageRepository =
    createPgRepositoryMock<ServerlessStorageRepository>()
  const logRepository = createPgRepositoryMock<ServerlessLogRepository>()
  const assetService = {
    writeUserCustomAsset: vi.fn(),
    getAsset: vi.fn(),
  }
  const redis = {
    get: vi.fn(),
    set: vi.fn(),
    expire: vi.fn(),
    hdel: vi.fn(),
  }
  const redisService = { getClient: vi.fn(() => redis) }
  const configService = { get: vi.fn() }
  const readerRepository = {
    findOwner: vi.fn().mockResolvedValue({
      id: 'owner-1',
      username: 'owner',
      email: 'owner@example.com',
    }),
  }
  const ownerRepository = {
    findByReaderId: vi.fn().mockResolvedValue({ mail: 'owner@example.com' }),
  }
  const eventService = { broadcast: vi.fn() }
  const service = new ServerlessService(
    snippetRepository as any,
    storageRepository as any,
    logRepository as any,
    assetService as any,
    redisService as any,
    configService as any,
    readerRepository as any,
    ownerRepository as any,
    eventService as any,
  )
  return { readerRepository, service, snippetRepository, storageRepository }
}

describe('ServerlessService', () => {
  it('validates exported handler functions before function snippets are stored', async () => {
    const { service } = createService()

    await expect(
      service.isValidServerlessFunction(
        'export default async function handler() { return "ok" }',
      ),
    ).resolves.toBe(true)
    await expect(
      service.isValidServerlessFunction('export const notHandler = () => {}'),
    ).resolves.toBe(false)
  })

  it('compiles TypeScript handler code for PG snippet persistence', async () => {
    const { service } = createService()

    await expect(
      service.compileTypescriptCode(
        'export default async function handler(req: any) { return req.query }',
      ),
    ).resolves.toContain('function handler')
  })

  it('detects built-in function snippets by PG repository row shape', async () => {
    const { service, snippetRepository } = createService()
    snippetRepository.findById.mockResolvedValue({
      id: 'fn-1',
      type: SnippetType.Function,
      builtIn: true,
      name: 'health',
      reference: 'built-in',
    })

    await expect(service.isBuiltInFunction('fn-1')).resolves.toEqual({
      name: 'health',
      reference: 'built-in',
    })
  })

  it('backs sandbox storage operations with the serverless PG storage repository', async () => {
    const { service, storageRepository } = createService()
    storageRepository.get.mockResolvedValue(null)
    storageRepository.upsert.mockResolvedValue({ id: 'storage-1' })

    const storage = (service as any).mockDb('namespace')
    await storage.set('key', { value: 1 })

    expect(storageRepository.upsert).toHaveBeenCalledWith('namespace', 'key', {
      value: 1,
    })
  })
})
