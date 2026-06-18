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

describe('SnippetService.findSkillsByIds', () => {
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

    const result = await service.findSkillsByIds(['1', '2'])

    expect(result.map((r) => r.name)).toEqual(['skill-a', 'skill-b'])
  })

  it('builds rawUrl from serverUrl and points at the SKILL.md leaf', async () => {
    const { service, repository } = createService('https://example.com/api/v3/')
    repository.findSkillsByIds.mockResolvedValue([createSnippet()])

    const result = await service.findSkillsByIds(['1'])

    expect(result[0].rawUrl).toBe(
      'https://example.com/api/v3/s/sk/my-skill/SKILL.md',
    )
  })

  it('falls back to a relative SKILL.md url when serverUrl is empty', async () => {
    const { service, repository } = createService('')
    repository.findSkillsByIds.mockResolvedValue([createSnippet()])

    const result = await service.findSkillsByIds(['1'])

    expect(result[0].rawUrl).toBe('/s/sk/my-skill/SKILL.md')
  })
})
