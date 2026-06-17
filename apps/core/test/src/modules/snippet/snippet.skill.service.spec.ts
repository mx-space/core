import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { AppException } from '~/common/errors/exception.types'
import type {
  SnippetRepository,
  SnippetRow,
} from '~/modules/snippet/snippet.repository'
import { SnippetType } from '~/modules/snippet/snippet.schema'
import { SnippetService } from '~/modules/snippet/snippet.service'

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
  name: 'my-skill',
  reference: 'skill',
  comment: 'A test skill',
  metatype: null,
  schema: null,
  method: null,
  customPath: 'sk/my-skill',
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

  return {
    configsService,
    eventManager,
    redis,
    repository,
    serverlessService,
    service,
  }
}

describe('SnippetService — Skill type', () => {
  it('happy path: sets comment, customPath from valid frontmatter', async () => {
    const { repository, service } = createService()
    const created = createSnippet()
    repository.countByNameReferenceMethod.mockResolvedValue(0)
    repository.create.mockResolvedValue(created)

    await service.create({
      type: SnippetType.Skill,
      raw: VALID_SKILL_RAW,
      name: 'my-skill',
    })

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        comment: 'A test skill',
        customPath: 'sk/my-skill',
        reference: 'skill',
      }),
    )
  })

  it('throws on malformed YAML in frontmatter', async () => {
    const { repository, service } = createService()
    repository.countByNameReferenceMethod.mockResolvedValue(0)

    const badYaml = `---\nname: [unclosed\ndescription: ok\n---\nbody\n`
    await expect(
      service.create({
        type: SnippetType.Skill,
        raw: badYaml,
        name: 'my-skill',
      }),
    ).rejects.toThrow(AppException)
  })

  it('throws when frontmatter block is absent', async () => {
    const { repository, service } = createService()
    repository.countByNameReferenceMethod.mockResolvedValue(0)

    await expect(
      service.create({
        type: SnippetType.Skill,
        raw: 'no frontmatter here',
        name: 'my-skill',
      }),
    ).rejects.toThrow(AppException)
  })

  it('throws when frontmatter name field is missing', async () => {
    const { repository, service } = createService()
    repository.countByNameReferenceMethod.mockResolvedValue(0)

    const raw = `---\ndescription: A skill\n---\nbody\n`
    await expect(
      service.create({
        type: SnippetType.Skill,
        raw,
        name: 'my-skill',
      }),
    ).rejects.toThrow(AppException)
  })

  it('throws when frontmatter name does not match model name', async () => {
    const { repository, service } = createService()
    repository.countByNameReferenceMethod.mockResolvedValue(0)

    const raw = `---\nname: other-skill\ndescription: A skill\n---\nbody\n`
    await expect(
      service.create({
        type: SnippetType.Skill,
        raw,
        name: 'my-skill',
      }),
    ).rejects.toThrow(AppException)
  })

  it('throws when frontmatter description is missing', async () => {
    const { repository, service } = createService()
    repository.countByNameReferenceMethod.mockResolvedValue(0)

    const raw = `---\nname: my-skill\n---\nbody\n`
    await expect(
      service.create({
        type: SnippetType.Skill,
        raw,
        name: 'my-skill',
      }),
    ).rejects.toThrow(AppException)
  })

  it('throws when frontmatter description is empty string', async () => {
    const { repository, service } = createService()
    repository.countByNameReferenceMethod.mockResolvedValue(0)

    const raw = `---\nname: my-skill\ndescription: ''\n---\nbody\n`
    await expect(
      service.create({
        type: SnippetType.Skill,
        raw,
        name: 'my-skill',
      }),
    ).rejects.toThrow(AppException)
  })

  it('preserves extra unknown frontmatter keys in raw without error', async () => {
    const { repository, service } = createService()
    const raw = `---\nname: my-skill\ndescription: A skill\ntags:\n  - foo\n  - bar\n---\nbody\n`
    const created = createSnippet({ raw })
    repository.countByNameReferenceMethod.mockResolvedValue(0)
    repository.create.mockResolvedValue(created)

    await expect(
      service.create({
        type: SnippetType.Skill,
        raw,
        name: 'my-skill',
      }),
    ).resolves.toBeDefined()

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ raw }),
    )
  })

  it('auto-fills customPath to sk/<name> when caller leaves it empty', async () => {
    const { repository, service } = createService()
    const created = createSnippet()
    repository.countByNameReferenceMethod.mockResolvedValue(0)
    repository.create.mockResolvedValue(created)

    await service.create({
      type: SnippetType.Skill,
      raw: VALID_SKILL_RAW,
      name: 'my-skill',
      customPath: '',
    })

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ customPath: 'sk/my-skill' }),
    )
  })

  it('respects caller-supplied customPath and does not overwrite it', async () => {
    const { repository, service } = createService()
    const created = createSnippet({ customPath: 'custom/path' })
    repository.countByNameReferenceMethod.mockResolvedValue(0)
    repository.countByCustomPath.mockResolvedValue(0)
    repository.create.mockResolvedValue(created)

    await service.create({
      type: SnippetType.Skill,
      raw: VALID_SKILL_RAW,
      name: 'my-skill',
      customPath: 'custom/path',
    })

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ customPath: 'custom/path' }),
    )
  })

  it('overwrites caller-supplied comment with frontmatter description', async () => {
    const { repository, service } = createService()
    const created = createSnippet()
    repository.countByNameReferenceMethod.mockResolvedValue(0)
    repository.create.mockResolvedValue(created)

    await service.create({
      type: SnippetType.Skill,
      raw: VALID_SKILL_RAW,
      name: 'my-skill',
      comment: 'caller comment that should be overwritten',
    })

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ comment: 'A test skill' }),
    )
  })

  it('attachSnippet returns data equal to raw for Skill rows', async () => {
    const { service } = createService()
    const row = createSnippet()

    const result = await service.attachSnippet(row)

    expect(result.data).toBe(row.raw)
  })
})

describe('SnippetService.findSkillsByIds', () => {
  it('returns empty array when ids is empty', async () => {
    const { service, repository } = createService()

    const result = await service.findSkillsByIds([])

    expect(result).toEqual([])
    expect(repository.findSkillsByIds).not.toHaveBeenCalled()
  })

  it('preserves input order against rows returned in a different order', async () => {
    const { service, repository } = createService()
    const row1 = createSnippet({
      id: '1' as any,
      name: 'skill-a',
      comment: 'A',
    })
    const row2 = createSnippet({
      id: '2' as any,
      name: 'skill-b',
      comment: 'B',
    })
    const row3 = createSnippet({
      id: '3' as any,
      name: 'skill-c',
      comment: 'C',
    })
    repository.findSkillsByIds.mockResolvedValue([row3, row1, row2])

    const result = await service.findSkillsByIds(['1', '2', '3'])

    expect(result.map((r) => r.name)).toEqual(['skill-a', 'skill-b', 'skill-c'])
  })

  it('drops ids that did not resolve to a row', async () => {
    const { service, repository } = createService()
    const row = createSnippet({ id: '1' as any, name: 'skill-a' })
    repository.findSkillsByIds.mockResolvedValue([row])

    const result = await service.findSkillsByIds(['1', 'nonexistent'])

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('skill-a')
  })

  it('non-skill rows are excluded (repository enforces this; verify via includePrivate passthrough)', async () => {
    const { service, repository } = createService()
    repository.findSkillsByIds.mockResolvedValue([])

    await service.findSkillsByIds(['99'], { includePrivate: false })

    expect(repository.findSkillsByIds).toHaveBeenCalledWith(['99'], false)
  })

  it('passes includePrivate=true to repository when option is set', async () => {
    const { service, repository } = createService()
    repository.findSkillsByIds.mockResolvedValue([])

    await service.findSkillsByIds(['1'], { includePrivate: true })

    expect(repository.findSkillsByIds).toHaveBeenCalledWith(['1'], true)
  })

  it('builds rawUrl from serverUrl', async () => {
    const { service, repository } = createService('https://example.com')
    const row = createSnippet({ id: '1' as any, name: 'my-skill' })
    repository.findSkillsByIds.mockResolvedValue([row])

    const result = await service.findSkillsByIds(['1'])

    expect(result[0].rawUrl).toBe('https://example.com/api/v3/s/sk/my-skill')
  })

  it('strips trailing slash from serverUrl before building rawUrl', async () => {
    const { service, repository } = createService('https://example.com/')
    const row = createSnippet({ id: '1' as any, name: 'my-skill' })
    repository.findSkillsByIds.mockResolvedValue([row])

    const result = await service.findSkillsByIds(['1'])

    expect(result[0].rawUrl).toBe('https://example.com/api/v3/s/sk/my-skill')
  })

  it('falls back to relative url when serverUrl is empty', async () => {
    const { service, repository } = createService('')
    const row = createSnippet({ id: '1' as any, name: 'my-skill' })
    repository.findSkillsByIds.mockResolvedValue([row])

    const result = await service.findSkillsByIds(['1'])

    expect(result[0].rawUrl).toBe('/api/v3/s/sk/my-skill')
  })
})

describe('SnippetService — Skill update reference preservation', () => {
  it('PATCH with reference=theme preserves theme (not reset to skill)', async () => {
    const { repository, service } = createService()
    const existing = createSnippet({ reference: 'theme' })
    repository.findById.mockResolvedValue(existing)
    repository.update.mockResolvedValue(existing)

    await service.update('1', {
      type: SnippetType.Skill,
      raw: VALID_SKILL_RAW,
      name: 'my-skill',
      reference: 'theme',
    })

    expect(repository.update).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ reference: 'theme' }),
    )
  })

  it('PATCH without reference does not reset stored reference to skill', async () => {
    const { repository, service } = createService()
    const existing = createSnippet({ reference: 'theme' })
    repository.findById.mockResolvedValue(existing)
    repository.update.mockResolvedValue(existing)

    await service.update('1', {
      type: SnippetType.Skill,
      raw: VALID_SKILL_RAW,
      name: 'my-skill',
    })

    const callArg = repository.update.mock.calls[0][1]
    expect(callArg.reference).not.toBe('skill')
  })
})
