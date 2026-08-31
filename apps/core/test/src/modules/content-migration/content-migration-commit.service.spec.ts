import { mxLexicalToMarkdown } from '@mx-space/editor'
import { ConflictException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { aiTranslations, drafts, posts } from '~/database/schema'
import type { MarkdownToLexicalMigrationDescriptor } from '~/modules/content-migration/content-migration.schema'
import { analyzeMigrationMarkdown } from '~/modules/content-migration/content-migration.utils'
import { ContentMigrationCommitService } from '~/modules/content-migration/content-migration-commit.service'
import { DraftRefType } from '~/modules/draft/draft.enum'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'

interface FakeState {
  branch: Record<string, any> | null
  document: Record<string, any> | null
  revision: Record<string, any> | null
  source: Record<string, any>
  translations: Array<Record<string, any>>
}

function createTransactionalDatabase(initial: FakeState) {
  let committed = structuredClone(initial)
  let lockCalls = 0

  return {
    get lockCalls() {
      return lockCalls
    },
    get state() {
      return committed
    },
    transaction: async (callback: (tx: any) => Promise<void>) => {
      const working = structuredClone(committed)
      let translationUpdateIndex = 0
      const tx = {
        execute: async () => {
          lockCalls += 1
        },
        select: () => ({
          from: (table: unknown) => {
            const rows =
              table === posts
                ? [working.source]
                : table === drafts
                  ? working.branch && working.document && working.revision
                    ? [
                        {
                          branch: working.branch,
                          document: working.document,
                          revision: working.revision,
                        },
                      ]
                    : []
                  : table === aiTranslations
                    ? working.translations
                    : []
            const builder = {
              for: async () => structuredClone(rows),
              innerJoin: () => builder,
              limit: () => builder,
              where: () => builder,
            }
            return builder
          },
        }),
        update: (table: unknown) => ({
          set: (patch: Record<string, unknown>) => ({
            where: async () => {
              if (table === posts) {
                Object.assign(working.source, patch)
              } else if (table === aiTranslations) {
                Object.assign(
                  working.translations[translationUpdateIndex++],
                  patch,
                )
              }
            },
          }),
        }),
      }

      await callback(tx)
      committed = working
    },
  }
}

const ref = { refId: '100', refType: DraftRefType.Post }
const sourceMarkdown = 'Hello\n\nWorld'

function sourceRow() {
  return {
    id: '100',
    title: 'Post',
    slug: 'post',
    text: sourceMarkdown,
    content: null,
    contentFormat: ContentFormat.Markdown,
    summary: null,
    tags: [],
    meta: { lang: 'en' },
    modifiedAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2025-01-01T00:00:00Z'),
  }
}

function translation(id: string, lang: string, text: string) {
  return {
    id,
    refId: '100',
    refType: DraftRefType.Post,
    lang,
    sourceLang: 'en',
    title: `Post ${lang}`,
    text,
    subtitle: null,
    summary: null,
    tags: [],
    hash: 'legacy-hash',
    sourceModifiedAt: null,
    aiModel: null,
    aiProvider: null,
    contentFormat: ContentFormat.Markdown,
    content: null,
    sourceBlockSnapshots: null,
    sourceMetaHashes: null,
    createdAt: new Date('2026-01-02T00:00:00Z'),
  }
}

function branchRows() {
  return {
    branch: {
      documentId: '400',
      headRevisionId: '500',
      id: '300',
    },
    document: {
      id: '400',
      refId: '100',
      refType: DraftRefType.Post,
    },
    revision: {
      content: null,
      contentFormat: ContentFormat.Markdown,
      id: '500',
      text: sourceMarkdown,
      title: 'Post',
    },
  }
}

function buildCommitInput(
  translations: Array<Record<string, any>>,
  includeDraft = true,
) {
  const baseline = analyzeMigrationMarkdown(sourceMarkdown, ref)
  if (baseline.status !== 'convertible') throw new Error('invalid fixture')

  const preconditions: MarkdownToLexicalMigrationDescriptor['preconditions'] = [
    {
      kind: 'source',
      id: '100' as any,
      hash: analyzeMigrationMarkdown(sourceMarkdown, ref).sourceHash,
    },
    ...translations.map((row) => ({
      kind: 'translation' as const,
      id: row.id as any,
      hash: analyzeMigrationMarkdown(row.text, ref, baseline.sourceHash)
        .sourceHash,
    })),
  ]
  if (includeDraft) {
    preconditions.push({
      kind: 'branch',
      id: '300' as any,
      hash: analyzeMigrationMarkdown(sourceMarkdown, ref).sourceHash,
      headRevisionId: '500' as any,
    })
  }

  const content = JSON.stringify(baseline.content)
  const descriptor: MarkdownToLexicalMigrationDescriptor = {
    profile: 'yohaku-v1',
    converterVersion: baseline.converterVersion,
    sourceMarkdown,
    sourceHash: baseline.sourceHash,
    preconditions,
  }

  return {
    ...ref,
    descriptor,
    branchId: includeDraft ? '300' : undefined,
    patch: {
      title: 'Post',
      text: mxLexicalToMarkdown(content),
      content,
      contentFormat: ContentFormat.Lexical,
      modifiedAt: new Date('2026-07-28T00:00:00Z'),
    },
    source: {
      title: 'Post',
      text: mxLexicalToMarkdown(content),
      content,
      contentFormat: ContentFormat.Lexical as const,
      summary: null,
      tags: [],
      meta: { lang: 'en' },
    },
  }
}

describe('ContentMigrationCommitService', () => {
  it('atomically migrates source and translations without mutating the revision', async () => {
    const translations = [translation('200', 'zh', '你好\n\n世界')]
    const rows = branchRows()
    const database = createTransactionalDatabase({
      source: sourceRow(),
      ...rows,
      translations,
    })
    const service = new ContentMigrationCommitService(
      database as never,
      new LexicalService(),
    )

    await service.commitMarkdownToLexical(buildCommitInput(translations))

    expect(database.state.source.contentFormat).toBe(ContentFormat.Lexical)
    expect(database.lockCalls).toBe(1)
    expect(database.state.translations[0].contentFormat).toBe(
      ContentFormat.Lexical,
    )
    expect(database.state.translations[0].sourceBlockSnapshots).toHaveLength(2)
    expect(database.state.revision).toEqual(rows.revision)

    const sourceBlocks = JSON.parse(database.state.source.content).root.children
    const translationBlocks = JSON.parse(database.state.translations[0].content)
      .root.children
    expect(sourceBlocks.map((block: any) => block.$.blockId)).toEqual(
      translationBlocks.map((block: any) => block.$.blockId),
    )
  })

  it('rolls back earlier translation writes when a later precondition is stale', async () => {
    const originalTranslations = [
      translation('200', 'zh', '你好\n\n世界'),
      translation('201', 'ja', 'こんにちは\n\n世界'),
    ]
    const input = buildCommitInput(originalTranslations, false)
    const database = createTransactionalDatabase({
      source: sourceRow(),
      branch: null,
      document: null,
      revision: null,
      translations: [
        originalTranslations[0],
        { ...originalTranslations[1], text: 'changed after dry-run' },
      ],
    })
    const before = structuredClone(database.state)
    const service = new ContentMigrationCommitService(
      database as never,
      new LexicalService(),
    )

    await expect(service.commitMarkdownToLexical(input)).rejects.toBeInstanceOf(
      ConflictException,
    )
    expect(database.state).toEqual(before)
  })
})
