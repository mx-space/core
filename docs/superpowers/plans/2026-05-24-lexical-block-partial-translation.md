# Lexical Block Partial Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return backend-composed partial Lexical translations that preserve unchanged translated blocks, render changed blocks as current source text, and asynchronously schedule regeneration without persisting the partial view.

**Architecture:** Extract the existing incremental block-reuse logic from `LexicalTranslationStrategy` into a shared helper module, then use that helper from both the write path and a new read-path partial builder. `AiTranslationService` will try the partial builder only after whole-document freshness fails, return the composed transient row, and reuse the existing stale-regeneration scheduler.

**Tech Stack:** NestJS services, TypeScript, Vitest, Lexical serialized JSON, `@haklex/rich-headless`, Drizzle-backed translation repository.

---

## Scope Check

This plan implements one subsystem: backend-only partial reuse for stale Lexical translations. It does not add schema, frontend merge logic, per-block persistence, or new search-index behavior.

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/core/src/modules/ai/ai-translation/lexical-block-reuse.ts` | Shared block grouping, shape compatibility, reusable translation backfill, and Mermaid guard. |
| `apps/core/src/modules/ai/ai-translation/strategies/lexical-translation.strategy.ts` | Continue full and incremental generation, now using shared block-reuse helpers. |
| `apps/core/src/modules/ai/ai-translation/lexical-partial-translation.builder.ts` | Build transient partial translation rows for read paths. |
| `apps/core/src/modules/ai/ai.module.ts` | Register the partial builder as a Nest provider. |
| `apps/core/src/modules/ai/ai-translation/ai-translation.service.ts` | Attempt partial read fallback and schedule regeneration through existing scheduler. |
| `apps/core/test/src/modules/ai/lexical-block-reuse.spec.ts` | Unit tests for shared reuse helpers and Mermaid guard behavior. |
| `apps/core/test/src/modules/ai/lexical-partial-translation.builder.spec.ts` | Unit tests for partial composition edge cases. |
| `apps/core/test/src/modules/ai/ai-translation.service.spec.ts` | Service-level tests for read-path scheduling and no-persistence behavior. |

## Task 1: Extract Shared Block-Reuse Helpers

**Files:**
- Create: `apps/core/src/modules/ai/ai-translation/lexical-block-reuse.ts`
- Modify: `apps/core/src/modules/ai/ai-translation/strategies/lexical-translation.strategy.ts`
- Test: `apps/core/test/src/modules/ai/lexical-block-reuse.spec.ts`

- [ ] **Step 1: Add failing helper tests**

Create `apps/core/test/src/modules/ai/lexical-block-reuse.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import {
  backfillReusableBlockTranslations,
  canReuseBlockTranslations,
  guardMermaidTranslations,
  groupSegmentsByBlock,
} from '~/modules/ai/ai-translation/lexical-block-reuse'
import type { LexicalTranslationResult } from '~/modules/ai/ai-translation/lexical-translation-parser'

const textSegment = (id: string, blockId: string, text: string) => ({
  id,
  blockId,
  text,
  node: { text },
  translatable: true,
  rootIndex: 0,
  flowId: null,
})

const propSegment = (
  id: string,
  blockId: string,
  property: string,
  text: string,
  key?: string,
) => ({
  id,
  blockId,
  property,
  text,
  key,
  node: key ? { [property]: { [key]: text } } : { [property]: text },
  rootIndex: 0,
})

describe('lexical block reuse helpers', () => {
  it('groups text and property segments by block id', () => {
    const result = {
      segments: [
        textSegment('t_0', 'block-a', 'A'),
        textSegment('t_1', 'block-b', 'B'),
      ],
      propertySegments: [propSegment('p_0', 'block-a', 'caption', 'Caption')],
      editorState: { root: { children: [] } },
    } as unknown as LexicalTranslationResult

    const grouped = groupSegmentsByBlock(result)

    expect(grouped.get('block-a')?.segments.map((s) => s.id)).toEqual(['t_0'])
    expect(grouped.get('block-a')?.propertySegments.map((s) => s.id)).toEqual([
      'p_0',
    ])
    expect(grouped.get('block-b')?.segments.map((s) => s.id)).toEqual(['t_1'])
  })

  it('rejects reusable blocks when property shape differs', () => {
    expect(
      canReuseBlockTranslations(
        {
          segments: [textSegment('t_0', 'block-a', 'A') as any],
          propertySegments: [propSegment('p_0', 'block-a', 'caption', 'A') as any],
        },
        {
          segments: [textSegment('t_9', 'block-a', 'Translated A') as any],
          propertySegments: [propSegment('p_9', 'block-a', 'alt', 'Translated A') as any],
        },
      ),
    ).toBe(false)
  })

  it('backfills only reusable unchanged blocks', () => {
    const current = {
      segments: [
        textSegment('t_0', 'block-a', '原文 A'),
        textSegment('t_1', 'block-b', '原文 B'),
      ],
      propertySegments: [],
      editorState: { root: { children: [] } },
    } as unknown as LexicalTranslationResult
    const translated = {
      segments: [
        textSegment('t_0', 'block-a', 'Translated A'),
        textSegment('t_1', 'block-b', 'Translated B'),
      ],
      propertySegments: [],
      editorState: { root: { children: [] } },
    } as unknown as LexicalTranslationResult
    const output = new Map<string, string>()

    const stats = backfillReusableBlockTranslations(
      current,
      translated,
      new Set(['block-a']),
      output,
    )

    expect(stats).toEqual({ reusedBlockIds: ['block-a'], skippedBlockIds: [] })
    expect(output.get('t_0')).toBe('Translated A')
    expect(output.has('t_1')).toBe(false)
  })

  it('removes invalid Mermaid translations before restore', () => {
    const warn = vi.fn()
    const sourceNode = { type: 'mermaid', diagram: 'flowchart TD\nA[源] --> B[终]' }
    const result = {
      segments: [],
      propertySegments: [
        {
          id: 'p_0',
          blockId: 'block-a',
          property: 'diagram',
          text: sourceNode.diagram,
          node: sourceNode,
          rootIndex: 0,
        },
      ],
      editorState: { root: { children: [] } },
    } as unknown as LexicalTranslationResult
    const translations = new Map([['p_0', 'not a mermaid diagram']])

    guardMermaidTranslations(result, translations, warn)

    expect(translations.has('p_0')).toBe(false)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Mermaid translation rejected'),
    )
  })
})
```

- [ ] **Step 2: Run the failing helper tests**

Run:

```bash
pnpm -C apps/core exec vitest run test/src/modules/ai/lexical-block-reuse.spec.ts
```

Expected result: TypeScript module resolution fails because `~/modules/ai/ai-translation/lexical-block-reuse` does not exist.

- [ ] **Step 3: Create the shared helper module**

Create `apps/core/src/modules/ai/ai-translation/lexical-block-reuse.ts`:

```ts
import type {
  LexicalTranslationResult,
  PropertySegment,
  TranslationSegment,
} from './lexical-translation-parser'
import { validateMermaidTranslation } from './mermaid-translation-guard'

export interface BlockTranslationSegments {
  segments: TranslationSegment[]
  propertySegments: PropertySegment[]
}

export interface BackfillReusableBlockResult {
  reusedBlockIds: string[]
  skippedBlockIds: string[]
}

export function groupSegmentsByBlock(
  result: LexicalTranslationResult,
): Map<string, BlockTranslationSegments> {
  const byBlock = new Map<string, BlockTranslationSegments>()

  const getBucket = (blockId: string) => {
    let bucket = byBlock.get(blockId)
    if (!bucket) {
      bucket = { segments: [], propertySegments: [] }
      byBlock.set(blockId, bucket)
    }
    return bucket
  }

  for (const segment of result.segments) {
    if (!segment.blockId || !segment.translatable) continue
    getBucket(segment.blockId).segments.push(segment)
  }

  for (const propertySegment of result.propertySegments) {
    if (!propertySegment.blockId) continue
    getBucket(propertySegment.blockId).propertySegments.push(propertySegment)
  }

  return byBlock
}

export function canReuseBlockTranslations(
  currentBlock: BlockTranslationSegments,
  translatedBlock: BlockTranslationSegments,
): boolean {
  if (currentBlock.segments.length !== translatedBlock.segments.length) {
    return false
  }

  if (
    currentBlock.propertySegments.length !==
    translatedBlock.propertySegments.length
  ) {
    return false
  }

  return currentBlock.propertySegments.every((segment, index) => {
    const translatedSegment = translatedBlock.propertySegments[index]
    return (
      translatedSegment.property === segment.property &&
      translatedSegment.key === segment.key
    )
  })
}

export function backfillReusableBlockTranslations(
  currentResult: LexicalTranslationResult,
  translatedResult: LexicalTranslationResult,
  unchangedBlockIds: Set<string>,
  output: Map<string, string>,
): BackfillReusableBlockResult {
  const currentBlocks = groupSegmentsByBlock(currentResult)
  const translatedBlocks = groupSegmentsByBlock(translatedResult)
  const reusedBlockIds: string[] = []
  const skippedBlockIds: string[] = []

  for (const blockId of unchangedBlockIds) {
    const currentBlock = currentBlocks.get(blockId)
    const translatedBlock = translatedBlocks.get(blockId)

    if (!currentBlock || !translatedBlock) {
      skippedBlockIds.push(blockId)
      continue
    }
    if (!canReuseBlockTranslations(currentBlock, translatedBlock)) {
      skippedBlockIds.push(blockId)
      continue
    }

    currentBlock.segments.forEach((segment, index) => {
      output.set(segment.id, translatedBlock.segments[index].text)
    })

    currentBlock.propertySegments.forEach((propertySegment, index) => {
      output.set(
        propertySegment.id,
        translatedBlock.propertySegments[index].text,
      )
    })
    reusedBlockIds.push(blockId)
  }

  return { reusedBlockIds, skippedBlockIds }
}

export function guardMermaidTranslations(
  parseResult: LexicalTranslationResult,
  translations: Map<string, string>,
  onReject?: (message: string) => void,
): void {
  for (const prop of parseResult.propertySegments) {
    if (prop.property !== 'diagram' || prop.node?.type !== 'mermaid') continue
    const translated = translations.get(prop.id)
    if (translated === undefined) continue
    if (translated === prop.text) continue

    const validation = validateMermaidTranslation(prop.text, translated)
    if (!validation.ok) {
      onReject?.(
        `Mermaid translation rejected: reason=${validation.reason} sourceLen=${prop.text.length} translatedLen=${translated.length}`,
      )
      translations.delete(prop.id)
    }
  }
}
```

- [ ] **Step 4: Refactor the Lexical strategy to use the shared helper**

Modify `apps/core/src/modules/ai/ai-translation/strategies/lexical-translation.strategy.ts`:

```ts
import {
  backfillReusableBlockTranslations,
  guardMermaidTranslations,
} from '../lexical-block-reuse'
```

Remove the local `BlockTranslationSegments` interface and delete the private methods `groupSegmentsByBlock()`, `canReuseBlockTranslations()`, and `backfillReusableBlockTranslations()`.

Replace existing calls:

```ts
const backfillResult = backfillReusableBlockTranslations(
  parseResult,
  translatedParseResult,
  unchangedBlockIds,
  allTranslations,
)
this.logger.log(
  `Incremental reuse: reused=${backfillResult.reusedBlockIds.length} skipped=${backfillResult.skippedBlockIds.length}`,
)
```

Replace `this.guardMermaidTranslations(parseResult, allTranslations)` with:

```ts
guardMermaidTranslations(parseResult, allTranslations, (message) =>
  this.logger.warn(message),
)
```

Delete the private `guardMermaidTranslations()` method from the strategy after both call sites use the shared helper.

- [ ] **Step 5: Run helper tests and existing translation tests**

Run:

```bash
pnpm -C apps/core exec vitest run test/src/modules/ai/lexical-block-reuse.spec.ts test/src/modules/ai/ai-translation.service.spec.ts
```

Expected result: all tests pass.

- [ ] **Step 6: Commit the helper extraction**

Run:

```bash
git add apps/core/src/modules/ai/ai-translation/lexical-block-reuse.ts apps/core/src/modules/ai/ai-translation/strategies/lexical-translation.strategy.ts apps/core/test/src/modules/ai/lexical-block-reuse.spec.ts
git commit --no-verify -m "refactor(ai): share lexical block reuse helpers"
```

## Task 2: Add Partial Lexical Translation Builder

**Files:**
- Create: `apps/core/src/modules/ai/ai-translation/lexical-partial-translation.builder.ts`
- Test: `apps/core/test/src/modules/ai/lexical-partial-translation.builder.spec.ts`

- [ ] **Step 1: Add failing partial-builder tests**

Create `apps/core/test/src/modules/ai/lexical-partial-translation.builder.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { LexicalPartialTranslationBuilder } from '~/modules/ai/ai-translation/lexical-partial-translation.builder'
import type { AiTranslationRow } from '~/modules/ai/ai-translation/ai-translation.types'
import { ContentFormat } from '~/shared/types/content-format.type'

const paragraph = (blockId: string | null, text: string) => ({
  type: 'paragraph',
  version: 1,
  children: [{ type: 'text', version: 1, text, format: 0 }],
  ...(blockId ? { $: { blockId } } : {}),
})

const editorState = (children: any[]) =>
  JSON.stringify({ root: { type: 'root', version: 1, children } })

const translationRow = (overrides: Partial<AiTranslationRow> = {}): AiTranslationRow =>
  ({
    id: 'translation-1' as any,
    hash: 'old-hash',
    refId: 'post-1' as any,
    refType: 'post',
    lang: 'en',
    sourceLang: 'zh',
    title: 'Old translated title',
    text: 'Old translated markdown',
    subtitle: 'Old translated subtitle',
    summary: 'Old translated summary',
    tags: ['old-tag'],
    sourceModifiedAt: null,
    aiModel: null,
    aiProvider: null,
    contentFormat: ContentFormat.Lexical,
    content: editorState([
      paragraph('block-a', 'Translated A'),
      paragraph('block-b', 'Translated B'),
      paragraph('deleted-block', 'Deleted translation'),
    ]),
    sourceBlockSnapshots: [
      { id: 'block-a', fingerprint: 'fp-a', type: 'paragraph', index: 0 },
      { id: 'block-b', fingerprint: 'old-fp-b', type: 'paragraph', index: 1 },
      { id: 'deleted-block', fingerprint: 'fp-deleted', type: 'paragraph', index: 2 },
    ],
    sourceMetaHashes: {
      title: 'title-hash',
      subtitle: 'subtitle-hash',
      summary: 'summary-hash',
      tags: 'tags-hash',
    },
    createdAt: new Date('2026-05-24T00:00:00.000Z'),
    ...overrides,
  }) as AiTranslationRow

const content = {
  title: '当前标题',
  text: '当前正文',
  subtitle: '当前副标题',
  summary: '当前摘要',
  tags: ['当前标签'],
  contentFormat: ContentFormat.Lexical,
  content: editorState([
    paragraph('block-a', '原文 A'),
    paragraph('block-b', '新的原文 B'),
  ]),
}

const createBuilder = () => {
  const lexicalService = {
    extractRootBlocks: vi.fn(() => [
      { id: 'block-a', type: 'paragraph', text: '原文 A', fingerprint: 'fp-a', index: 0 },
      { id: 'block-b', type: 'paragraph', text: '新的原文 B', fingerprint: 'new-fp-b', index: 1 },
    ]),
    lexicalToMarkdown: vi.fn(() => 'Translated A\n\n新的原文 B'),
  }
  return {
    lexicalService,
    builder: new LexicalPartialTranslationBuilder(lexicalService as any),
  }
}

describe('LexicalPartialTranslationBuilder', () => {
  it('reuses unchanged blocks, falls changed blocks back to source, and drops deleted blocks', () => {
    const { builder, lexicalService } = createBuilder()

    const result = builder.build(content, translationRow())

    expect(result).not.toBeNull()
    expect(result?.stats).toEqual({
      totalBlockCount: 2,
      changedBlockCount: 1,
      reusedBlockCount: 1,
      skippedReusableBlockCount: 0,
    })
    const parsed = JSON.parse(result!.translation.content!)
    expect(parsed.root.children.map((child: any) => child.children[0].text)).toEqual([
      'Translated A',
      '新的原文 B',
    ])
    expect(result?.translation.text).toBe('Translated A\n\n新的原文 B')
    expect(lexicalService.lexicalToMarkdown).toHaveBeenCalledWith(
      result?.translation.content,
    )
  })

  it('falls changed meta fields back to source using the incremental md5 scheme', () => {
    const { builder } = createBuilder()

    const result = builder.build(content, translationRow())

    expect(result?.translation.title).toBe('当前标题')
    expect(result?.translation.subtitle).toBe('当前副标题')
    expect(result?.translation.summary).toBe('当前摘要')
    expect(result?.translation.tags).toEqual(['当前标签'])
  })

  it('returns null when the existing translated content cannot be parsed', () => {
    const { builder } = createBuilder()

    expect(builder.build(content, translationRow({ content: '{broken' }))).toBeNull()
  })

  it('treats a block without block id as changed', () => {
    const lexicalService = {
      extractRootBlocks: vi.fn(() => [
        { id: null, type: 'paragraph', text: '无 ID', fingerprint: 'fp-no-id', index: 0 },
      ]),
      lexicalToMarkdown: vi.fn(() => '无 ID'),
    }
    const builder = new LexicalPartialTranslationBuilder(lexicalService as any)
    const result = builder.build(
      {
        ...content,
        content: editorState([paragraph(null, '无 ID')]),
      },
      translationRow({
        content: editorState([paragraph('old-id', 'Translated old')]),
        sourceBlockSnapshots: [{ id: 'old-id', fingerprint: 'fp-no-id' }],
      }),
    )

    const parsed = JSON.parse(result!.translation.content!)
    expect(parsed.root.children[0].children[0].text).toBe('无 ID')
    expect(result?.stats.changedBlockCount).toBe(1)
    expect(result?.stats.reusedBlockCount).toBe(0)
  })
})
```

- [ ] **Step 2: Run the failing partial-builder tests**

Run:

```bash
pnpm -C apps/core exec vitest run test/src/modules/ai/lexical-partial-translation.builder.spec.ts
```

Expected result: TypeScript module resolution fails because `lexical-partial-translation.builder.ts` does not exist.

- [ ] **Step 3: Implement the partial builder**

Create `apps/core/src/modules/ai/ai-translation/lexical-partial-translation.builder.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common'

import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'
import { md5 } from '~/utils/tool.util'

import type { ArticleContent, AiTranslationRow } from './ai-translation.types'
import {
  backfillReusableBlockTranslations,
  guardMermaidTranslations,
} from './lexical-block-reuse'
import {
  parseLexicalForTranslation,
  restoreLexicalTranslation,
} from './lexical-translation-parser'

interface LexicalSourceBlockSnapshot {
  id: string
  fingerprint: string
  type?: string
  index?: number
}

interface LexicalSourceMetaHashes {
  title?: string | null
  subtitle?: string | null
  summary?: string | null
  tags?: string | null
}

export interface PartialLexicalTranslationStats {
  totalBlockCount: number
  changedBlockCount: number
  reusedBlockCount: number
  skippedReusableBlockCount: number
}

export interface PartialLexicalTranslationResult {
  translation: AiTranslationRow
  stats: PartialLexicalTranslationStats
}

@Injectable()
export class LexicalPartialTranslationBuilder {
  private readonly logger = new Logger(LexicalPartialTranslationBuilder.name)

  constructor(private readonly lexicalService: LexicalService) {}

  build(
    content: ArticleContent,
    existing: AiTranslationRow,
  ): PartialLexicalTranslationResult | null {
    if (content.contentFormat !== ContentFormat.Lexical || !content.content) {
      return null
    }
    if (
      existing.contentFormat !== ContentFormat.Lexical ||
      !existing.content
    ) {
      return null
    }

    const snapshots = this.readBlockSnapshots(existing.sourceBlockSnapshots)
    if (!snapshots.length) return null

    const currentBlocks = this.lexicalService.extractRootBlocks(content.content)
    if (!currentBlocks.length) return null

    const snapshotMap = new Map(snapshots.map((s) => [s.id, s.fingerprint]))
    const unchangedBlockIds = new Set<string>()
    let changedBlockCount = 0

    for (const block of currentBlocks) {
      if (
        block.id &&
        snapshotMap.has(block.id) &&
        snapshotMap.get(block.id) === block.fingerprint
      ) {
        unchangedBlockIds.add(block.id)
      } else {
        changedBlockCount += 1
      }
    }

    try {
      const currentParseResult = parseLexicalForTranslation(content.content)
      const translatedParseResult = parseLexicalForTranslation(existing.content)
      const translations = new Map<string, string>()
      const backfill = backfillReusableBlockTranslations(
        currentParseResult,
        translatedParseResult,
        unchangedBlockIds,
        translations,
      )

      guardMermaidTranslations(currentParseResult, translations, (message) =>
        this.logger.warn(message),
      )

      const translatedContent = restoreLexicalTranslation(
        currentParseResult,
        translations,
      )
      const text = this.lexicalService.lexicalToMarkdown(translatedContent)
      const meta = this.composeMeta(content, existing)

      this.logger.log(
        `Partial lexical translation: refId=${existing.refId} lang=${existing.lang} totalBlocks=${currentBlocks.length} changed=${changedBlockCount} reused=${backfill.reusedBlockIds.length} skipped=${backfill.skippedBlockIds.length}`,
      )

      return {
        translation: {
          ...existing,
          ...meta,
          text,
          contentFormat: ContentFormat.Lexical,
          content: translatedContent,
        },
        stats: {
          totalBlockCount: currentBlocks.length,
          changedBlockCount,
          reusedBlockCount: backfill.reusedBlockIds.length,
          skippedReusableBlockCount: backfill.skippedBlockIds.length,
        },
      }
    } catch (error) {
      this.logger.warn(
        `Partial lexical translation failed: refId=${existing.refId} lang=${existing.lang} message=${(error as Error).message}`,
      )
      return null
    }
  }

  private readBlockSnapshots(value: unknown): LexicalSourceBlockSnapshot[] {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is LexicalSourceBlockSnapshot => {
      if (!item || typeof item !== 'object') return false
      const row = item as Record<string, unknown>
      return typeof row.id === 'string' && typeof row.fingerprint === 'string'
    })
  }

  private readMetaHashes(value: unknown): LexicalSourceMetaHashes | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    return value as LexicalSourceMetaHashes
  }

  private composeMeta(content: ArticleContent, existing: AiTranslationRow) {
    const oldMetaHashes = this.readMetaHashes(existing.sourceMetaHashes)
    const title =
      oldMetaHashes?.title === md5(content.title) ? existing.title : content.title

    const subtitle = content.subtitle
      ? oldMetaHashes?.subtitle === md5(content.subtitle) && existing.subtitle
        ? existing.subtitle
        : content.subtitle
      : null

    const summary = content.summary
      ? oldMetaHashes?.summary === md5(content.summary) && existing.summary
        ? existing.summary
        : content.summary
      : null

    const tags = content.tags?.length
      ? oldMetaHashes?.tags === md5(content.tags.join('|||')) &&
        existing.tags?.length
        ? existing.tags
        : content.tags
      : (content.tags ?? [])

    return { title, subtitle, summary, tags }
  }
}
```

- [ ] **Step 4: Run the partial-builder tests**

Run:

```bash
pnpm -C apps/core exec vitest run test/src/modules/ai/lexical-partial-translation.builder.spec.ts
```

Expected result: all tests pass.

- [ ] **Step 5: Commit the builder**

Run:

```bash
git add apps/core/src/modules/ai/ai-translation/lexical-partial-translation.builder.ts apps/core/test/src/modules/ai/lexical-partial-translation.builder.spec.ts
git commit --no-verify -m "feat(ai): build partial lexical translations"
```

## Task 3: Wire Partial Reads Into Translation Service

**Files:**
- Modify: `apps/core/src/modules/ai/ai.module.ts`
- Modify: `apps/core/src/modules/ai/ai-translation/ai-translation.service.ts`
- Modify: `apps/core/test/src/modules/ai/ai-translation.service.spec.ts`

- [ ] **Step 1: Add failing service tests**

Append these tests to `apps/core/test/src/modules/ai/ai-translation.service.spec.ts`:

```ts
  it('returns a partial lexical translation for stale article translation and schedules regeneration', async () => {
    const { databaseService, repository, service, partialBuilder, translationConsistencyService } =
      createService()
    const stale = row({
      contentFormat: ContentFormat.Lexical,
      content: '{"root":{"children":[]}}',
    })
    const partial = row({
      contentFormat: ContentFormat.Lexical,
      content: '{"root":{"children":[{"type":"paragraph"}]}}',
      text: 'partial markdown',
    })

    databaseService.findGlobalById.mockResolvedValue({
      id: 'post-1',
      document: {
        id: 'post-1',
        title: '源标题',
        text: '源正文',
        contentFormat: ContentFormat.Lexical,
        content: '{"root":{"children":[]}}',
        meta: { lang: 'zh' },
      },
    })
    repository.findByRefAndLang.mockResolvedValue(stale)
    translationConsistencyService.evaluateTranslationFreshness.mockReturnValue('stale')
    partialBuilder.build.mockReturnValue({
      translation: partial,
      stats: {
        totalBlockCount: 2,
        changedBlockCount: 1,
        reusedBlockCount: 1,
        skippedReusableBlockCount: 0,
      },
    })
    const schedule = vi
      .spyOn(service, 'scheduleRegenerationForStaleTranslations')
      .mockResolvedValue(undefined)

    await expect(service.getTranslationForArticle('post-1', 'en')).resolves.toEqual(partial)
    expect(repository.updateById).not.toHaveBeenCalled()
    expect(repository.upsert).not.toHaveBeenCalled()
    expect(schedule).toHaveBeenCalledWith(['post-1'], 'en')
  })

  it('keeps existing stale behavior when partial composition is unavailable', async () => {
    const { databaseService, repository, service, partialBuilder, translationConsistencyService } =
      createService()
    const stale = row({
      contentFormat: ContentFormat.Lexical,
      content: '{"root":{"children":[]}}',
    })

    databaseService.findGlobalById.mockResolvedValue({
      id: 'post-1',
      document: {
        id: 'post-1',
        title: '源标题',
        text: '源正文',
        contentFormat: ContentFormat.Lexical,
        content: '{"root":{"children":[]}}',
        meta: { lang: 'zh' },
      },
    })
    repository.findByRefAndLang.mockResolvedValue(stale)
    translationConsistencyService.evaluateTranslationFreshness.mockReturnValue('stale')
    partialBuilder.build.mockReturnValue(null)
    const schedule = vi
      .spyOn(service, 'scheduleRegenerationForStaleTranslations')
      .mockResolvedValue(undefined)

    await expect(service.getTranslationForArticle('post-1', 'en')).resolves.toBeNull()
    expect(schedule).toHaveBeenCalledWith(['post-1'], 'en')
  })
```

Update `createService()` in the same test file so mocks expose the new dependencies:

```ts
  const translationConsistencyService = {
    evaluateTranslationFreshness: vi.fn(),
    partitionValidAndStaleTranslations: vi.fn(),
    filterTrulyStaleTranslations: vi.fn(),
  }
  const partialBuilder = { build: vi.fn() }
```

Return `partialBuilder` and `translationConsistencyService` from `createService()`, and pass `partialBuilder as any` into the `AiTranslationService` constructor at the same position added in implementation.

- [ ] **Step 2: Run the failing service tests**

Run:

```bash
pnpm -C apps/core exec vitest run test/src/modules/ai/ai-translation.service.spec.ts
```

Expected result: constructor mismatch or missing partial-builder integration failure.

- [ ] **Step 3: Register the builder provider**

Modify `apps/core/src/modules/ai/ai.module.ts`:

```ts
import { LexicalPartialTranslationBuilder } from './ai-translation/lexical-partial-translation.builder'
```

Add `LexicalPartialTranslationBuilder` to the `providers` array next to `LexicalTranslationStrategy`.

- [ ] **Step 4: Inject the builder into `AiTranslationService`**

Modify imports in `apps/core/src/modules/ai/ai-translation/ai-translation.service.ts`:

```ts
import { LexicalPartialTranslationBuilder } from './lexical-partial-translation.builder'
```

Add the constructor parameter after `lexicalService`:

```ts
    private readonly lexicalService: LexicalService,
    private readonly lexicalPartialTranslationBuilder: LexicalPartialTranslationBuilder,
    private readonly aiTaskService: AiTaskService,
```

- [ ] **Step 5: Add a scheduler helper for stale read paths**

Add this private method to `AiTranslationService` near `scheduleRegenerationForStaleTranslations()`:

```ts
  private scheduleStaleTranslationRegenerationBestEffort(
    articleId: string,
    targetLang: string,
  ) {
    this.scheduleRegenerationForStaleTranslations([articleId], targetLang).catch(
      (err) =>
        this.logger.error(
          'Failed to schedule stale translation regeneration',
          err,
        ),
    )
  }
```

- [ ] **Step 6: Use the partial builder in `getTranslationForArticle()`**

Replace the end of `getTranslationForArticle()` with:

```ts
    if (status === 'valid') {
      return translation
    }

    if (status === 'stale') {
      const partial = this.lexicalPartialTranslationBuilder.build(
        this.toArticleContent(document),
        translation,
      )
      this.scheduleStaleTranslationRegenerationBestEffort(articleId, targetLang)
      return partial?.translation ?? null
    }

    return null
```

- [ ] **Step 7: Use the partial builder in `getTranslationAndAvailableLanguages()`**

Modify the matched translation section:

```ts
    let matchedTranslation: AITranslationModel | null = null
    if (targetLang) {
      const direct = translations.find((t) => t.lang === targetLang)
      if (direct) {
        const directStatus =
          this.translationConsistencyService.evaluateTranslationFreshness(
            snapshot,
            direct,
          )
        if (directStatus === 'valid') {
          matchedTranslation = direct
        } else if (directStatus === 'stale') {
          const partial = this.lexicalPartialTranslationBuilder.build(
            this.toArticleContent(document),
            direct,
          )
          matchedTranslation = partial?.translation ?? null
        }
      }
    }
```

Keep `availableTranslations` as `validLangs` unless product requirements later require exposing partial languages as available. This preserves existing language-list semantics while allowing a requested stale language to render a backend-composed response.

- [ ] **Step 8: Run service tests**

Run:

```bash
pnpm -C apps/core exec vitest run test/src/modules/ai/ai-translation.service.spec.ts
```

Expected result: all tests pass.

- [ ] **Step 9: Commit service wiring**

Run:

```bash
git add apps/core/src/modules/ai/ai.module.ts apps/core/src/modules/ai/ai-translation/ai-translation.service.ts apps/core/test/src/modules/ai/ai-translation.service.spec.ts
git commit --no-verify -m "feat(ai): return partial lexical translation reads"
```

## Task 4: Complete Edge-Case Coverage and Verification

**Files:**
- Modify: `apps/core/test/src/modules/ai/lexical-partial-translation.builder.spec.ts`
- Modify: `apps/core/test/src/modules/ai/lexical-block-reuse.spec.ts`
- Verify: `apps/core/src/modules/ai/ai-translation/lexical-partial-translation.builder.ts`

- [ ] **Step 1: Add exact edge-case tests from the spec**

Append these tests to `apps/core/test/src/modules/ai/lexical-partial-translation.builder.spec.ts`:

```ts
  it('returns an equivalent composed result when the document hash is stale but all blocks are unchanged', () => {
    const lexicalService = {
      extractRootBlocks: vi.fn(() => [
        { id: 'block-a', type: 'paragraph', text: '原文 A', fingerprint: 'fp-a', index: 0 },
        { id: 'block-b', type: 'paragraph', text: '原文 B', fingerprint: 'old-fp-b', index: 1 },
      ]),
      lexicalToMarkdown: vi.fn(() => 'Translated A\n\nTranslated B'),
    }
    const builder = new LexicalPartialTranslationBuilder(lexicalService as any)
    const result = builder.build(
      {
        ...content,
        content: editorState([
          paragraph('block-a', '原文 A'),
          paragraph('block-b', '原文 B'),
        ]),
      },
      translationRow(),
    )

    const parsed = JSON.parse(result!.translation.content!)
    expect(parsed.root.children.map((child: any) => child.children[0].text)).toEqual([
      'Translated A',
      'Translated B',
    ])
    expect(result?.stats.changedBlockCount).toBe(0)
    expect(result?.stats.reusedBlockCount).toBe(2)
  })

  it('does not persist or leak an old translated block deleted from the source', () => {
    const lexicalService = {
      extractRootBlocks: vi.fn(() => [
        { id: 'block-a', type: 'paragraph', text: '原文 A', fingerprint: 'fp-a', index: 0 },
      ]),
      lexicalToMarkdown: vi.fn(() => 'Translated A'),
    }
    const builder = new LexicalPartialTranslationBuilder(lexicalService as any)
    const result = builder.build(
      {
        ...content,
        content: editorState([paragraph('block-a', '原文 A')]),
      },
      translationRow(),
    )

    const parsed = JSON.parse(result!.translation.content!)
    expect(parsed.root.children).toHaveLength(1)
    expect(parsed.root.children[0].children[0].text).toBe('Translated A')
    expect(JSON.stringify(parsed)).not.toContain('Deleted translation')
  })
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm -C apps/core exec vitest run test/src/modules/ai/lexical-block-reuse.spec.ts test/src/modules/ai/lexical-partial-translation.builder.spec.ts test/src/modules/ai/ai-translation.service.spec.ts
```

Expected result: all tests pass.

- [ ] **Step 3: Run the broader core test command for the touched area**

Run:

```bash
pnpm -C apps/core run test -- test/src/modules/ai/lexical-block-reuse.spec.ts test/src/modules/ai/lexical-partial-translation.builder.spec.ts test/src/modules/ai/ai-translation.service.spec.ts
```

Expected result: all listed test files pass under the package test script.

- [ ] **Step 4: Run type and lint checks for changed files**

Run:

```bash
pnpm -C apps/core run lint
```

Expected result: lint completes without errors. If this repository lint command is broader than the touched area and fails on unrelated existing files, record the unrelated failure text and run the focused Vitest commands from Step 2 as the verification floor.

- [ ] **Step 5: Inspect git diff for persistence and cache invariants**

Run:

```bash
git diff -- apps/core/src/modules/ai/ai-translation apps/core/src/modules/ai/ai.module.ts
```

Expected inspection result:

- No migration files are added.
- No repository `upsert()` or `updateById()` call writes a partial translation.
- No search indexing path consumes the partial builder result.
- `getTranslationForArticle()` schedules regeneration through `scheduleRegenerationForStaleTranslations()`.
- `LexicalTranslationStrategy` and `LexicalPartialTranslationBuilder` both use `lexical-block-reuse.ts`.

- [ ] **Step 6: Commit final coverage and verification fixes**

Run:

```bash
git add apps/core/test/src/modules/ai/lexical-partial-translation.builder.spec.ts apps/core/test/src/modules/ai/lexical-block-reuse.spec.ts apps/core/src/modules/ai/ai-translation/lexical-partial-translation.builder.ts apps/core/src/modules/ai/ai-translation/lexical-block-reuse.ts apps/core/src/modules/ai/ai-translation/strategies/lexical-translation.strategy.ts apps/core/src/modules/ai/ai-translation/ai-translation.service.ts apps/core/src/modules/ai/ai.module.ts apps/core/test/src/modules/ai/ai-translation.service.spec.ts
git commit --no-verify -m "test(ai): cover lexical partial translation edges"
```

## Final Verification

- [ ] **Run all focused tests**

```bash
pnpm -C apps/core exec vitest run test/src/modules/ai/lexical-block-reuse.spec.ts test/src/modules/ai/lexical-partial-translation.builder.spec.ts test/src/modules/ai/ai-translation.service.spec.ts
```

Expected result: all focused tests pass.

- [ ] **Run lint**

```bash
pnpm -C apps/core run lint
```

Expected result: lint passes, or unrelated pre-existing lint failures are documented with exact output.

- [ ] **Check final status**

```bash
git status --short
```

Expected result: clean working tree after the final commit, or only intentionally uncommitted files explicitly listed in the handoff.

## Self-Review Checklist

| Spec requirement | Covered by |
| --- | --- |
| Backend-composed partial translation | Task 2, Task 3 |
| Changed blocks fall back to source | Task 2 tests, Task 4 invariant tests |
| No frontend merge logic | Task 3 service returns translation-like object |
| No canonical persistence of partial rows | Task 3 tests, Task 4 diff inspection |
| Shared read/write block helpers | Task 1 |
| Mermaid guard on partial reuse | Task 1 helper, Task 2 builder |
| Identical meta hash scheme | Task 2 builder |
| Existing scheduler reuse | Task 3 |
| Cache/search non-pollution | Task 4 diff inspection |
| Deleted old translated block does not leak | Task 4 tests |
| Observability for partial read counts | Task 2 builder log |
