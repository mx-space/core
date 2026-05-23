import { describe, expect, it, vi } from 'vitest'

import {
  backfillReusableBlockTranslations,
  canReuseBlockTranslations,
  guardMermaidTranslations,
  groupSegmentsByBlock,
  type BlockTranslationSegments,
} from '~/modules/ai/ai-translation/lexical-block-reuse'
import type {
  LexicalTranslationResult,
  PropertySegment,
  TranslationSegment,
} from '~/modules/ai/ai-translation/lexical-translation-parser'

const textSegment = (
  id: string,
  text: string,
  blockId: string | null,
  translatable = true,
): TranslationSegment => ({
  id,
  text,
  node: {},
  translatable,
  blockId,
  rootIndex: 0,
  flowId: null,
})

const propertySegment = (
  id: string,
  text: string,
  blockId: string | null,
  property = 'summary',
  key?: string,
  node: any = {},
): PropertySegment => ({
  id,
  text,
  node,
  property,
  key,
  blockId,
  rootIndex: 0,
})

const translationResult = (
  segments: TranslationSegment[],
  propertySegments: PropertySegment[],
): LexicalTranslationResult => ({
  segments,
  propertySegments,
  editorState: { root: { children: [] } },
})

describe('lexical-block-reuse', () => {
  it('groups text and property segments by block id', () => {
    const result = translationResult(
      [
        textSegment('t_0', 'Alpha', 'block-a'),
        textSegment('t_1', 'Code', 'block-a', false),
        textSegment('t_2', 'No block', null),
        textSegment('t_3', 'Beta', 'block-b'),
      ],
      [
        propertySegment('p_0', 'Caption', 'block-a', 'caption'),
        propertySegment('p_1', 'Detached', null, 'caption'),
        propertySegment('p_2', 'Title', 'block-b', 'title'),
      ],
    )

    const grouped = groupSegmentsByBlock(result)

    expect([...grouped.keys()]).toEqual(['block-a', 'block-b'])
    expect(
      grouped.get('block-a')?.segments.map((segment) => segment.id),
    ).toEqual(['t_0'])
    expect(
      grouped.get('block-a')?.propertySegments.map((segment) => segment.id),
    ).toEqual(['p_0'])
    expect(
      grouped.get('block-b')?.segments.map((segment) => segment.id),
    ).toEqual(['t_3'])
    expect(
      grouped.get('block-b')?.propertySegments.map((segment) => segment.id),
    ).toEqual(['p_2'])
  })

  it('rejects block reuse when property shape differs', () => {
    const currentBlock: BlockTranslationSegments = {
      segments: [textSegment('t_0', 'Alpha', 'block-a')],
      propertySegments: [
        propertySegment('p_0', 'Caption', 'block-a', 'caption', 'primary'),
      ],
    }
    const translatedBlock: BlockTranslationSegments = {
      segments: [textSegment('t_9', 'Translated Alpha', 'block-a')],
      propertySegments: [
        propertySegment('p_9', 'Translated Caption', 'block-a', 'caption'),
      ],
    }

    expect(canReuseBlockTranslations(currentBlock, translatedBlock)).toBe(false)
  })

  it('backfills only unchanged reusable blocks and returns reuse stats', () => {
    const currentResult = translationResult(
      [
        textSegment('t_0', 'Alpha', 'block-a'),
        textSegment('t_1', 'Beta', 'block-b'),
      ],
      [propertySegment('p_0', 'Caption', 'block-a', 'caption', 'primary')],
    )
    const translatedResult = translationResult(
      [
        textSegment('t_8', 'Alpha translated', 'block-a'),
        textSegment('t_9', 'Beta translated', 'block-b'),
      ],
      [
        propertySegment(
          'p_8',
          'Caption translated',
          'block-a',
          'caption',
          'primary',
        ),
      ],
    )
    const output = new Map<string, string>()

    const result = backfillReusableBlockTranslations(
      currentResult,
      translatedResult,
      new Set(['block-a']),
      output,
    )

    expect(result).toEqual({
      reusedBlockIds: ['block-a'],
      skippedBlockIds: [],
    })
    expect(Object.fromEntries(output)).toEqual({
      t_0: 'Alpha translated',
      p_0: 'Caption translated',
    })
    expect(output.has('t_1')).toBe(false)
  })

  it('removes invalid Mermaid translations and calls the rejection callback', () => {
    const parseResult = translationResult(
      [],
      [
        propertySegment(
          'p_0',
          'graph TD\n  A-->B',
          'block-a',
          'diagram',
          undefined,
          { type: 'mermaid' },
        ),
      ],
    )
    const translations = new Map([['p_0', 'sequenceDiagram\n  A-->B']])
    const onReject = vi.fn()

    guardMermaidTranslations(parseResult, translations, onReject)

    expect(translations.has('p_0')).toBe(false)
    expect(onReject).toHaveBeenCalledOnce()
    expect(onReject).toHaveBeenCalledWith(
      expect.stringContaining('Mermaid translation rejected:'),
    )
  })
})
