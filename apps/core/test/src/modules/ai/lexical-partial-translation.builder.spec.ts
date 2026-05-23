import { describe, expect, it, vi } from 'vitest'

import type {
  AiTranslationRow,
  ArticleContent,
} from '~/modules/ai/ai-translation/ai-translation.types'
import { LexicalPartialTranslationBuilder } from '~/modules/ai/ai-translation/lexical-partial-translation.builder'
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

const editorState = (
  children: Array<ReturnType<typeof paragraph>>,
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
    (child: any) => child.children[0]?.text,
  )

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
})
