import { describe, expect, it } from 'vitest'

import {
  renderTeaserText,
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
