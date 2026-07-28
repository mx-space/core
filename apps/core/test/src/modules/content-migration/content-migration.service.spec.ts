import { BadRequestException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { ContentMigrationService } from '~/modules/content-migration/content-migration.service'
import { DraftRefType } from '~/modules/draft/draft.enum'

function translation(overrides: Record<string, unknown> = {}) {
  return {
    id: '200',
    refId: '100',
    refType: DraftRefType.Post,
    lang: 'en',
    sourceLang: 'zh',
    title: 'Title',
    text: 'Hello\n\nWorld',
    subtitle: null,
    summary: null,
    tags: [],
    hash: 'source-hash',
    sourceModifiedAt: null,
    aiModel: null,
    aiProvider: null,
    contentFormat: 'markdown',
    content: null,
    sourceBlockSnapshots: null,
    sourceMetaHashes: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function createService(
  options: {
    source?: Record<string, unknown> | null
    draft?: Record<string, unknown> | null
    translations?: Record<string, unknown>[]
  } = {},
) {
  const postService = {
    findById: vi.fn().mockResolvedValue(
      options.source === undefined
        ? {
            id: '100',
            text: '你好\n\n世界',
            content: null,
            contentFormat: 'markdown',
            modifiedAt: new Date('2026-01-01T00:00:00Z'),
          }
        : options.source,
    ),
  }
  const noteService = { findById: vi.fn() }
  const pageService = { findById: vi.fn() }
  const draftService = {
    findById: vi.fn().mockResolvedValue(options.draft ?? null),
  }
  const translationRepository = {
    listByRefId: vi
      .fn()
      .mockResolvedValue(options.translations ?? [translation()]),
  }

  const service = new ContentMigrationService(
    postService as never,
    noteService as never,
    pageService as never,
    draftService as never,
    translationRepository as never,
  )

  return {
    service,
    postService,
    draftService,
    translationRepository,
  }
}

const request = {
  refType: DraftRefType.Post,
  refId: '100',
  sourceText: '你好\n\n世界',
  profile: 'yohaku-v1' as const,
}

describe('ContentMigrationService', () => {
  it('dry-runs source and translations with aligned deterministic block IDs', async () => {
    const { service, postService, translationRepository } = createService()

    const result = await service.dryRunMarkdownToLexical(request)

    expect(result.status).toBe('convertible')
    expect(result.issues).toEqual([])
    expect(result.translations).toHaveLength(1)
    expect(result.translations[0].alignment).toEqual({
      sourceBlockCount: 2,
      translationBlockCount: 2,
      alignedBlockCount: 2,
    })

    expect(result.source.status).toBe('convertible')
    expect(result.translations[0].result.status).toBe('convertible')
    if (
      result.source.status === 'convertible' &&
      result.translations[0].result.status === 'convertible'
    ) {
      const sourceBlocks = result.source.content.root.children as any[]
      const translationBlocks = result.translations[0].result.content.root
        .children as any[]
      expect(sourceBlocks.map((block) => block.$.blockId)).toEqual(
        translationBlocks.map((block) => block.$.blockId),
      )
    }

    expect(result.preconditions.map((item) => item.kind)).toEqual([
      'source',
      'translation',
    ])
    expect(postService.findById).toHaveBeenCalledWith('100')
    expect(translationRepository.listByRefId).toHaveBeenCalledWith('100')
  })

  it('attributes an unsupported translation blocker to its language and row', async () => {
    const { service } = createService({
      translations: [translation({ text: '<Tabs>legacy</Tabs>' })],
    })

    const result = await service.dryRunMarkdownToLexical(request)

    expect(result.status).toBe('blocked')
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported-raw-html',
          member: 'translation',
          memberId: '200',
          lang: 'en',
        }),
      ]),
    )
    expect(result.source.status).toBe('convertible')
  })

  it('blocks migration when translated root blocks cannot align to the source', async () => {
    const { service } = createService({
      translations: [translation({ text: 'Only one block' })],
    })

    const result = await service.dryRunMarkdownToLexical(request)

    expect(result.status).toBe('blocked')
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'translation-structure-mismatch',
        details: {
          sourceBlockCount: 2,
          translationBlockCount: 1,
          alignedBlockCount: 1,
        },
        member: 'translation',
      }),
    )
  })

  it('checks stable non-translatable block properties, not only node type and index', async () => {
    const { service } = createService({
      source: {
        id: '100',
        text: '```ts\nconst answer = 42\n```',
        content: null,
        contentFormat: 'markdown',
      },
      translations: [translation({ text: '```ts\nconst answer = 7\n```' })],
    })

    const result = await service.dryRunMarkdownToLexical({
      ...request,
      sourceText: '```ts\nconst answer = 42\n```',
    })

    expect(result.status).toBe('blocked')
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'translation-structure-mismatch',
        details: expect.objectContaining({ alignedBlockCount: 0 }),
      }),
    )
  })

  it('rejects a draft precondition that belongs to another document', async () => {
    const { service } = createService({
      draft: {
        id: '300',
        refId: '999',
        refType: DraftRefType.Post,
        text: 'Draft',
        content: null,
        contentFormat: 'markdown',
        version: 4,
      },
    })

    await expect(
      service.dryRunMarkdownToLexical({ ...request, draftId: '300' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
