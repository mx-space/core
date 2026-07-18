import { describe, expect, it } from 'vitest'

import {
  countTopLevelBlocks,
  getPublicContent,
  getPublicText,
  renderTeaserText,
  resolveEffectivePreviewBlocks,
  truncateLexicalContent,
} from '~/processors/helper/lexical-truncate.util'

function makeEditorState(children: any[]) {
  return JSON.stringify({
    root: {
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  })
}

function textNode(text: string) {
  return {
    detail: 0,
    format: 0,
    mode: 'normal',
    style: '',
    text,
    type: 'text',
    version: 1,
  }
}

function paragraph(...children: any[]) {
  return {
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'paragraph',
    version: 1,
  }
}

describe('truncateLexicalContent', () => {
  it('keeps exactly N top-level blocks', () => {
    const content = makeEditorState([
      paragraph(textNode('one')),
      paragraph(textNode('two')),
      paragraph(textNode('three')),
    ])

    const truncated = truncateLexicalContent(content, 2)
    const parsed = JSON.parse(truncated)

    expect(parsed.root.children).toHaveLength(2)
    expect(parsed.root.children[0].children[0].text).toBe('one')
    expect(parsed.root.children[1].children[0].text).toBe('two')
  })

  it('returns content unchanged when N >= block count', () => {
    const content = makeEditorState([
      paragraph(textNode('one')),
      paragraph(textNode('two')),
    ])

    expect(truncateLexicalContent(content, 2)).toBe(content)
    expect(truncateLexicalContent(content, 5)).toBe(content)
  })

  it('throws on invalid JSON', () => {
    expect(() => truncateLexicalContent('not json', 2)).toThrow()
  })

  it('throws when root.children is missing', () => {
    expect(() => truncateLexicalContent('{"root":{}}', 2)).toThrow()
  })

  it('truncates to zero blocks when N is 0', () => {
    const content = makeEditorState([paragraph(textNode('one'))])

    const truncated = truncateLexicalContent(content, 0)
    const parsed = JSON.parse(truncated)

    expect(parsed.root.children).toHaveLength(0)
  })
})

describe('renderTeaserText', () => {
  it('equals $toMarkdown of the truncated state', () => {
    const content = makeEditorState([
      paragraph(textNode('one')),
      paragraph(textNode('two')),
      paragraph(textNode('three')),
    ])

    const truncated = truncateLexicalContent(content, 2)
    const teaser = renderTeaserText(truncated)

    expect(teaser).toBe('one\n\ntwo')
  })

  it('returns empty string for a zero-block state', () => {
    const truncated = truncateLexicalContent(
      makeEditorState([paragraph(textNode('one'))]),
      0,
    )

    expect(renderTeaserText(truncated)).toBe('')
  })

  it('throws on invalid JSON', () => {
    expect(() => renderTeaserText('not json')).toThrow()
  })
})

describe('countTopLevelBlocks', () => {
  it('counts root.children length', () => {
    const content = makeEditorState([
      paragraph(textNode('one')),
      paragraph(textNode('two')),
      paragraph(textNode('three')),
    ])

    expect(countTopLevelBlocks(content)).toBe(3)
  })
})

describe('resolveEffectivePreviewBlocks', () => {
  const threeBlockContent = makeEditorState([
    paragraph(textNode('one')),
    paragraph(textNode('two')),
    paragraph(textNode('three')),
  ])

  it('clamps configured N to blockCount - 1', () => {
    expect(resolveEffectivePreviewBlocks(threeBlockContent, 3)).toBe(2)
    expect(resolveEffectivePreviewBlocks(threeBlockContent, 100)).toBe(2)
  })

  it('defaults to 3 when unconfigured', () => {
    const fiveBlockContent = makeEditorState([
      paragraph(textNode('a')),
      paragraph(textNode('b')),
      paragraph(textNode('c')),
      paragraph(textNode('d')),
      paragraph(textNode('e')),
    ])

    expect(resolveEffectivePreviewBlocks(fiveBlockContent, undefined)).toBe(3)
  })

  it('clamps configured N below 1 up to 1', () => {
    expect(resolveEffectivePreviewBlocks(threeBlockContent, 0)).toBe(1)
    expect(resolveEffectivePreviewBlocks(threeBlockContent, -5)).toBe(1)
  })

  it('floors at 0 for a single-block post', () => {
    const oneBlockContent = makeEditorState([paragraph(textNode('solo'))])

    expect(resolveEffectivePreviewBlocks(oneBlockContent, 3)).toBe(0)
  })

  it('ignores non-numeric configured values and falls back to default', () => {
    expect(resolveEffectivePreviewBlocks(threeBlockContent, 'nope')).toBe(2)
  })
})

describe('getPublicText', () => {
  const threeBlockContent = makeEditorState([
    paragraph(textNode('one')),
    paragraph(textNode('two')),
    paragraph(textNode('three')),
  ])

  it('returns full text for a non-premium post', () => {
    expect(
      getPublicText({ isPremium: false, text: 'full text', content: null }),
    ).toBe('full text')
  })

  it('returns the teaser for a premium post', () => {
    expect(
      getPublicText({
        isPremium: true,
        text: 'full text',
        content: threeBlockContent,
      }),
    ).toBe('one\n\ntwo')
  })

  it('fails closed to an empty string when premium content is not a lexical JSON string', () => {
    expect(
      getPublicText({ isPremium: true, text: 'full text', content: null }),
    ).toBe('')
    expect(
      getPublicText({
        isPremium: true,
        text: 'full text',
        content: 'not json',
      }),
    ).toBe('')
  })
})

describe('getPublicContent', () => {
  const threeBlockContent = makeEditorState([
    paragraph(textNode('one')),
    paragraph(textNode('two')),
    paragraph(textNode('three')),
  ])

  it('returns full content for a non-premium post', () => {
    expect(
      getPublicContent({
        isPremium: false,
        text: '',
        content: threeBlockContent,
      }),
    ).toBe(threeBlockContent)
  })

  it('returns the truncated content for a premium post', () => {
    const truncated = getPublicContent({
      isPremium: true,
      text: '',
      content: threeBlockContent,
    })
    expect(JSON.parse(truncated!).root.children).toHaveLength(2)
  })

  it('fails closed to null when premium content is not a lexical JSON string', () => {
    expect(
      getPublicContent({ isPremium: true, text: '', content: null }),
    ).toBeNull()
  })
})
