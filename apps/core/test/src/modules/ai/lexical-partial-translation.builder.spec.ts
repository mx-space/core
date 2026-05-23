import { describe, expect, it, vi } from 'vitest'

import type {
  AiTranslationRow,
  ArticleContent,
} from '~/modules/ai/ai-translation/ai-translation.types'
import { LexicalPartialTranslationBuilder } from '~/modules/ai/ai-translation/lexical-partial-translation.builder'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'
import { md5 } from '~/utils/tool.util'

const now = new Date('2026-05-24T00:00:00.000Z')

const textNode = (text: string) => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text,
  type: 'text',
  version: 1,
})

const paragraph = (text: string, blockId?: string) => ({
  children: [textNode(text)],
  direction: null,
  format: '',
  indent: 0,
  type: 'paragraph',
  version: 1,
  ...(blockId ? { $: { blockId } } : {}),
})

const emptyParagraph = (blockId: string) => ({
  children: [],
  direction: null,
  format: '',
  indent: 0,
  type: 'paragraph',
  version: 1,
  $: { blockId },
})

const mermaidNode = (diagram: string, blockId: string) => ({
  type: 'mermaid',
  version: 1,
  diagram,
  $: { blockId },
})

const editorState = (
  children: Array<
    | ReturnType<typeof paragraph>
    | ReturnType<typeof emptyParagraph>
    | ReturnType<typeof mermaidNode>
  >,
): string =>
  JSON.stringify({
    root: {
      children,
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  })

const rootTexts = (content: string): string[] =>
  JSON.parse(content).root.children.map(
    (child: any) => child.children?.[0]?.text,
  )

const rootDiagrams = (content: string): string[] =>
  JSON.parse(content).root.children
    .filter((child: any) => child.type === 'mermaid')
    .map((child: any) => child.diagram)

const row = (overrides: Partial<AiTranslationRow> = {}): AiTranslationRow => ({
  id: 'translation-1' as any,
  hash: 'hash',
  refId: 'post-1' as any,
  refType: 'post',
  lang: 'en',
  sourceLang: 'zh',
  title: 'Translated Title',
  text: 'Translated markdown',
  subtitle: 'Translated Subtitle',
  summary: 'Translated Summary',
  tags: ['translated-tag'],
  sourceModifiedAt: null,
  aiModel: 'model',
  aiProvider: 'provider',
  contentFormat: ContentFormat.Lexical,
  content: editorState([paragraph('Translated unchanged', 'block-a')]),
  sourceBlockSnapshots: [{ id: 'block-a', fingerprint: 'fp-a' }],
  sourceMetaHashes: { title: md5('Title') },
  createdAt: now,
  ...overrides,
})

const content = (overrides: Partial<ArticleContent> = {}): ArticleContent => ({
  title: 'Title',
  text: 'Source markdown',
  subtitle: null,
  summary: null,
  tags: [],
  contentFormat: ContentFormat.Lexical,
  content: editorState([paragraph('Source unchanged', 'block-a')]),
  ...overrides,
})

const createBuilder = () => {
  const lexicalService = {
    extractRootBlocks: vi.fn(),
    lexicalToMarkdown: vi.fn((translatedContent: string) =>
      rootTexts(translatedContent).join('\n'),
    ),
  }
  const builder = new LexicalPartialTranslationBuilder(lexicalService as any)

  return { builder, lexicalService }
}

describe('LexicalPartialTranslationBuilder', () => {
  it('reuses every eligible unchanged block even when the document hash differs', () => {
    const { builder, lexicalService } = createBuilder()
    const sourceContent = editorState([
      paragraph('Source first', 'block-a'),
      paragraph('Source second', 'block-b'),
    ])
    const existingContent = editorState([
      paragraph('Translated first', 'block-a'),
      paragraph('Translated second', 'block-b'),
    ])
    lexicalService.extractRootBlocks.mockReturnValue([
      {
        id: 'block-a',
        type: 'paragraph',
        text: 'Source first',
        fingerprint: 'fp-a',
        index: 0,
      },
      {
        id: 'block-b',
        type: 'paragraph',
        text: 'Source second',
        fingerprint: 'fp-b',
        index: 1,
      },
    ])

    const result = builder.build(
      content({ content: sourceContent }),
      row({
        hash: 'different-whole-document-hash',
        content: existingContent,
        sourceBlockSnapshots: [
          { id: 'block-a', fingerprint: 'fp-a' },
          { id: 'block-b', fingerprint: 'fp-b' },
        ],
      }),
    )

    expect(result?.stats).toEqual({
      totalBlockCount: 2,
      changedBlockCount: 0,
      reusedBlockCount: 2,
      skippedReusableBlockCount: 0,
    })
    expect(rootTexts(result!.translation.content!)).toEqual([
      'Translated first',
      'Translated second',
    ])
  })

  it('reuses unchanged blocks, keeps changed blocks as source, and omits deleted old blocks', () => {
    const { builder, lexicalService } = createBuilder()
    const sourceContent = editorState([
      paragraph('Source unchanged', 'block-a'),
      paragraph('Source changed', 'block-b'),
    ])
    const existingContent = editorState([
      paragraph('Translated unchanged', 'block-a'),
      paragraph('Translated stale', 'block-b'),
      paragraph('Translated deleted', 'block-c'),
    ])
    lexicalService.extractRootBlocks.mockReturnValue([
      {
        id: 'block-a',
        type: 'paragraph',
        text: 'Source unchanged',
        fingerprint: 'fp-a',
        index: 0,
      },
      {
        id: 'block-b',
        type: 'paragraph',
        text: 'Source changed',
        fingerprint: 'fp-b-new',
        index: 1,
      },
    ])

    const result = builder.build(
      content({ content: sourceContent }),
      row({
        content: existingContent,
        sourceBlockSnapshots: [
          { id: 'block-a', fingerprint: 'fp-a' },
          { id: 'block-b', fingerprint: 'fp-b-old' },
          { id: 'block-c', fingerprint: 'fp-c' },
        ],
      }),
    )

    expect(result?.stats).toEqual({
      totalBlockCount: 2,
      changedBlockCount: 1,
      reusedBlockCount: 1,
      skippedReusableBlockCount: 0,
    })
    expect(rootTexts(result!.translation.content!)).toEqual([
      'Translated unchanged',
      'Source changed',
    ])
    expect(result!.translation.text).toBe('Translated unchanged\nSource changed')
  })

  it('falls changed meta fields back to source values using stored md5 hashes', () => {
    const { builder, lexicalService } = createBuilder()
    lexicalService.extractRootBlocks.mockReturnValue([
      {
        id: 'block-a',
        type: 'paragraph',
        text: 'Source unchanged',
        fingerprint: 'fp-a',
        index: 0,
      },
    ])

    const result = builder.build(
      content({
        title: 'Title',
        subtitle: 'New Subtitle',
        summary: 'New Summary',
        tags: ['new-tag'],
      }),
      row({
        title: 'Translated Title',
        subtitle: 'Old Translated Subtitle',
        summary: 'Old Translated Summary',
        tags: ['old-translated-tag'],
        sourceMetaHashes: {
          title: md5('Title'),
          subtitle: md5('Old Subtitle'),
          summary: md5('Old Summary'),
          tags: md5('old-tag'),
        },
      }),
    )

    expect(result?.translation).toEqual(
      expect.objectContaining({
        title: 'Translated Title',
        subtitle: 'New Subtitle',
        summary: 'New Summary',
        tags: ['new-tag'],
      }),
    )
  })

  it('returns null when existing translated content cannot be parsed', () => {
    const { builder, lexicalService } = createBuilder()
    lexicalService.extractRootBlocks.mockReturnValue([
      {
        id: 'block-a',
        type: 'paragraph',
        text: 'Source unchanged',
        fingerprint: 'fp-a',
        index: 0,
      },
    ])

    expect(builder.build(content(), row({ content: 'not json' }))).toBeNull()
  })

  it('counts unchanged-fingerprint blocks without reusable segments as changed', () => {
    const { builder, lexicalService } = createBuilder()
    const sourceContent = editorState([emptyParagraph('block-empty')])
    const existingContent = editorState([emptyParagraph('block-empty')])
    lexicalService.extractRootBlocks.mockReturnValue([
      {
        id: 'block-empty',
        type: 'paragraph',
        text: '',
        fingerprint: 'fp-empty',
        index: 0,
      },
    ])

    const result = builder.build(
      content({ content: sourceContent }),
      row({
        content: existingContent,
        sourceBlockSnapshots: [{ id: 'block-empty', fingerprint: 'fp-empty' }],
      }),
    )

    expect(result?.stats).toEqual({
      totalBlockCount: 1,
      changedBlockCount: 1,
      reusedBlockCount: 0,
      skippedReusableBlockCount: 1,
    })
  })

  it('returns null when markdown rendering fails', () => {
    const { builder, lexicalService } = createBuilder()
    lexicalService.extractRootBlocks.mockReturnValue([
      {
        id: 'block-a',
        type: 'paragraph',
        text: 'Source unchanged',
        fingerprint: 'fp-a',
        index: 0,
      },
    ])
    lexicalService.lexicalToMarkdown.mockImplementation(() => {
      throw new Error('markdown failed')
    })

    expect(builder.build(content(), row())).toBeNull()
  })

  it('returns null when current Lexical content cannot be parsed', () => {
    const { builder, lexicalService } = createBuilder()
    lexicalService.extractRootBlocks.mockReturnValue([
      {
        id: 'block-a',
        type: 'paragraph',
        text: 'Source unchanged',
        fingerprint: 'fp-a',
        index: 0,
      },
    ])

    expect(builder.build(content({ content: 'not json' }), row())).toBeNull()
  })

  it('treats a current block without block id as changed and returns source text', () => {
    const { builder, lexicalService } = createBuilder()
    const sourceContent = editorState([paragraph('Anonymous source')])
    const existingContent = editorState([paragraph('Anonymous translated')])
    lexicalService.extractRootBlocks.mockReturnValue([
      {
        id: null,
        type: 'paragraph',
        text: 'Anonymous source',
        fingerprint: 'fp-anonymous',
        index: 0,
      },
    ])

    const result = builder.build(
      content({ content: sourceContent }),
      row({
        content: existingContent,
        sourceBlockSnapshots: [{ id: '', fingerprint: 'fp-anonymous' }],
      }),
    )

    expect(result?.stats).toEqual({
      totalBlockCount: 1,
      changedBlockCount: 1,
      reusedBlockCount: 0,
      skippedReusableBlockCount: 0,
    })
    expect(rootTexts(result!.translation.content!)).toEqual([
      'Anonymous source',
    ])
    expect(result!.translation.text).toBe('Anonymous source')
  })

  it('falls back to the current Mermaid source when an unchanged block has an invalid reused diagram translation', () => {
    const { builder, lexicalService } = createBuilder()
    const sourceDiagram = 'graph TD\n  A[Input] --> B[Output]'
    const invalidTranslatedDiagram = 'sequenceDiagram\n  A-->B'
    const sourceContent = editorState([
      mermaidNode(sourceDiagram, 'block-mermaid'),
    ])
    const existingContent = editorState([
      mermaidNode(invalidTranslatedDiagram, 'block-mermaid'),
    ])
    lexicalService.extractRootBlocks.mockReturnValue([
      {
        id: 'block-mermaid',
        type: 'mermaid',
        text: sourceDiagram,
        fingerprint: 'fp-mermaid',
        index: 0,
      },
    ])

    const result = builder.build(
      content({ content: sourceContent }),
      row({
        content: existingContent,
        sourceBlockSnapshots: [
          { id: 'block-mermaid', fingerprint: 'fp-mermaid' },
        ],
      }),
    )

    expect(result?.stats).toEqual({
      totalBlockCount: 1,
      changedBlockCount: 0,
      reusedBlockCount: 1,
      skippedReusableBlockCount: 0,
    })
    expect(rootDiagrams(result!.translation.content!)).toEqual([sourceDiagram])
  })

  it('keeps the current Mermaid source when its diagram changed under the same block id', () => {
    const lexicalService = new LexicalService()
    const builder = new LexicalPartialTranslationBuilder(lexicalService)
    const oldSourceDiagram = 'graph TD\n  A[Input] --> B[Old]'
    const currentSourceDiagram = 'graph TD\n  A[Input] --> C[Current]'
    const oldTranslatedDiagram = 'graph TD\n  A[Translated] --> B[Stale]'
    const oldSourceContent = editorState([
      mermaidNode(oldSourceDiagram, 'block-mermaid'),
    ])
    const currentSourceContent = editorState([
      mermaidNode(currentSourceDiagram, 'block-mermaid'),
    ])
    const existingTranslatedContent = editorState([
      mermaidNode(oldTranslatedDiagram, 'block-mermaid'),
    ])
    const [oldSourceBlock] = lexicalService.extractRootBlocks(oldSourceContent)

    const result = builder.build(
      content({ content: currentSourceContent }),
      row({
        content: existingTranslatedContent,
        sourceBlockSnapshots: [
          {
            id: 'block-mermaid',
            fingerprint: oldSourceBlock.fingerprint,
          },
        ],
      }),
    )

    expect(result?.stats).toEqual({
      totalBlockCount: 1,
      changedBlockCount: 1,
      reusedBlockCount: 0,
      skippedReusableBlockCount: 0,
    })
    expect(rootDiagrams(result!.translation.content!)).toEqual([
      currentSourceDiagram,
    ])
    expect(rootDiagrams(result!.translation.content!)).not.toContain(
      oldTranslatedDiagram,
    )
  })
})
