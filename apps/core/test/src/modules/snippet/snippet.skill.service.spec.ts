import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { AppException } from '~/common/errors/exception.types'
import type { SnippetRepository } from '~/modules/snippet/snippet.repository'
import { SnippetType } from '~/modules/snippet/snippet.schema'
import { SnippetService } from '~/modules/snippet/snippet.service'
import type { SnippetRow } from '~/modules/snippet/snippet.types'

const VALID_SKILL_RAW = `---
name: my-skill
description: A test skill
---
This is the skill body.
`

const createSnippet = (overrides: Partial<SnippetRow> = {}): SnippetRow => ({
  id: '1' as any,
  type: SnippetType.Skill,
  private: false,
  raw: VALID_SKILL_RAW,
  path: 'sk/my-skill/SKILL.md',
  comment: 'A test skill',
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

const createService = (serverUrl = 'http://localhost:2333') => {
  const repository = createPgRepositoryMock<SnippetRepository>()
  const serverlessService = {
    isValidServerlessFunction: vi.fn().mockResolvedValue(true),
    compileTypescriptCode: vi.fn(async (code: string) => `compiled:${code}`),
  }
  const redis = { hset: vi.fn(), hget: vi.fn(), hdel: vi.fn() }
  const redisService = { getClient: vi.fn(() => redis) }
  const eventManager = { emit: vi.fn() }
  const configsService = {
    get: vi.fn().mockResolvedValue({ serverUrl }),
  }

  const service = new SnippetService(
    repository as any,
    serverlessService as any,
    redisService as any,
    eventManager as any,
    configsService as any,
  )

  return { configsService, eventManager, redis, repository, service }
}

describe('SnippetService — Skill type', () => {
  it('creates a skill only at sk/<name>/SKILL.md and stores description as comment', async () => {
    const { repository, service } = createService()
    const created = createSnippet()
    repository.countByPathMethod.mockResolvedValue(0)
    repository.create.mockResolvedValue(created)

    await service.create({
      type: SnippetType.Skill,
      raw: VALID_SKILL_RAW,
      path: 'sk/my-skill/SKILL.md',
    })

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        comment: 'A test skill',
        path: 'sk/my-skill/SKILL.md',
        type: SnippetType.Skill,
      }),
    )
  })

  it.each([
    'skill/my-skill/SKILL.md',
    'skills/my-skill/SKILL.md',
    'my-skill/SKILL.md',
  ])('normalizes %s to the canonical sk/ root', async (path) => {
    const { repository, service } = createService()
    repository.countByPathMethod.mockResolvedValue(0)
    repository.create.mockResolvedValue(createSnippet())

    await service.create({
      type: SnippetType.Skill,
      raw: VALID_SKILL_RAW,
      path,
    })

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sk/my-skill/SKILL.md' }),
    )
  })

  it('throws when the skill path does not end in /SKILL.md', async () => {
    const { repository, service } = createService()
    repository.countByPathMethod.mockResolvedValue(0)

    await expect(
      service.create({
        type: SnippetType.Skill,
        raw: VALID_SKILL_RAW,
        path: 'sk/my-skill/readme.md',
      }),
    ).rejects.toThrow(AppException)
  })

  it('throws when frontmatter name does not match path parent directory', async () => {
    const { repository, service } = createService()
    repository.countByPathMethod.mockResolvedValue(0)

    await expect(
      service.create({
        type: SnippetType.Skill,
        raw: VALID_SKILL_RAW,
        path: 'sk/other-skill/SKILL.md',
      }),
    ).rejects.toThrow(AppException)
  })

  it('attachSnippet returns data equal to raw for Skill rows', async () => {
    const { service } = createService()
    const row = createSnippet()

    const result = await service.attachSnippet(row)

    expect(result.data).toBe(row.raw)
  })
})

describe('SnippetService.findSkillBundlesByIds', () => {
  it('preserves input order and derives names from paths', async () => {
    const { service, repository } = createService()
    const row1 = createSnippet({
      id: '1' as any,
      path: 'sk/skill-a/SKILL.md',
      comment: 'A',
    })
    const row2 = createSnippet({
      id: '2' as any,
      path: 'sk/skill-b/SKILL.md',
      comment: 'B',
    })
    repository.findSkillsByIds.mockResolvedValue([row2, row1])
    repository.findAssetsByDirs.mockResolvedValue([])

    const result = await service.findSkillBundlesByIds(['1', '2'])

    expect(result.map((r) => r.name)).toEqual(['skill-a', 'skill-b'])
  })

  it('builds rawUrl from serverUrl and points at the SKILL.md leaf', async () => {
    const { service, repository } = createService('https://example.com/api/v3/')
    repository.findSkillsByIds.mockResolvedValue([createSnippet()])
    repository.findAssetsByDirs.mockResolvedValue([])

    const result = await service.findSkillBundlesByIds(['1'])

    expect(result[0].rawUrl).toBe(
      'https://example.com/api/v3/s/sk/my-skill/SKILL.md',
    )
  })

  it('falls back to a relative SKILL.md url when serverUrl is empty', async () => {
    const { service, repository } = createService('')
    repository.findSkillsByIds.mockResolvedValue([createSnippet()])
    repository.findAssetsByDirs.mockResolvedValue([])

    const result = await service.findSkillBundlesByIds(['1'])

    expect(result[0].rawUrl).toBe('/s/sk/my-skill/SKILL.md')
  })

  it('groups asset rows under the right bundle dir', async () => {
    const { service, repository } = createService('https://example.com')
    const root = createSnippet({
      id: '1' as any,
      path: 'sk/my-skill/SKILL.md',
    })
    const asset1 = createSnippet({
      id: '2' as any,
      type: SnippetType.Text,
      path: 'sk/my-skill/references/foo.md',
      raw: 'asset body',
      comment: null,
    })
    const asset2 = createSnippet({
      id: '3' as any,
      type: SnippetType.JSON,
      path: 'sk/my-skill/config.json',
      raw: '{}',
      comment: null,
    })
    repository.findSkillsByIds.mockResolvedValue([root])
    repository.findAssetsByDirs.mockResolvedValue([asset2, asset1])

    const result = await service.findSkillBundlesByIds(['1'])

    expect(result).toHaveLength(1)
    expect(result[0].assets.map((a) => a.path)).toEqual([
      'config.json',
      'references/foo.md',
    ])
    expect(result[0].assets[0].rawUrl).toBe(
      'https://example.com/s/sk/my-skill/config.json',
    )
    expect(result[0].assets[1].size).toBe(
      Buffer.byteLength('asset body', 'utf8'),
    )
  })

  it('passes includePrivate flag through to both repository calls', async () => {
    const { service, repository } = createService()
    repository.findSkillsByIds.mockResolvedValue([createSnippet()])
    repository.findAssetsByDirs.mockResolvedValue([])

    await service.findSkillBundlesByIds(['1'], { includePrivate: true })

    expect(repository.findSkillsByIds).toHaveBeenCalledWith(['1'], true)
    expect(repository.findAssetsByDirs).toHaveBeenCalledWith(['sk/my-skill'], {
      includePrivate: true,
    })
  })
})

describe('SnippetService.importSnippets', () => {
  it('returns early with empty totals when there are no inputs', async () => {
    const { service, repository } = createService()

    const result = await service.importSnippets([])

    expect(result).toEqual({ created: 0, updated: 0, snippets: [] })
    expect(repository.upsertManyByPath).not.toHaveBeenCalled()
  })

  it('prepares every input before calling upsertManyByPath', async () => {
    const { service, repository } = createService()
    const created = createSnippet({
      id: '1' as any,
      type: SnippetType.JSON,
      path: 'cfg/a.json',
      raw: '{"a":1}',
      comment: null,
    })
    repository.upsertManyByPath.mockResolvedValue({
      created: 1,
      updated: 0,
      snippets: [created],
    })

    const result = await service.importSnippets([
      { type: SnippetType.JSON, raw: '{"a":1}', path: 'cfg/a.json' },
    ])

    expect(repository.upsertManyByPath).toHaveBeenCalledTimes(1)
    const call = repository.upsertManyByPath.mock.calls[0][0]
    expect(call[0]).toMatchObject({
      type: SnippetType.JSON,
      path: 'cfg/a.json',
    })
    expect(result.created).toBe(1)
    expect(result.updated).toBe(0)
    expect(result.snippets).toHaveLength(1)
  })

  it('throws synchronously when any input fails validation; repo is not touched', async () => {
    const { service, repository } = createService()

    await expect(
      service.importSnippets([
        { type: SnippetType.JSON, raw: '{"a":1}', path: 'cfg/a.json' },
        { type: SnippetType.JSON, raw: 'not-json', path: 'cfg/b.json' },
      ]),
    ).rejects.toThrow(AppException)

    expect(repository.upsertManyByPath).not.toHaveBeenCalled()
  })

  it('invalidates the snippet cache for each affected path after a successful import', async () => {
    const { service, repository, redis } = createService()
    const row = createSnippet({
      id: '1' as any,
      type: SnippetType.JSON,
      path: 'cfg/a.json',
      raw: '{}',
      comment: null,
    })
    repository.upsertManyByPath.mockResolvedValue({
      created: 0,
      updated: 1,
      snippets: [row],
    })

    await service.importSnippets([
      { type: SnippetType.JSON, raw: '{}', path: 'cfg/a.json' },
    ])

    expect(redis.hdel).toHaveBeenCalled()
  })
})
