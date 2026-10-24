import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'
import { describe, expect, it } from 'vitest'

import { buildSelectionXml } from './selection-xml'

function para(id: string, text: string): SerializedLexicalNode {
  return {
    type: 'paragraph',
    version: 1,
    children: [
      {
        type: 'text',
        text,
        version: 1,
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    $: { blockId: id },
  } as SerializedLexicalNode
}

const doc = {
  root: {
    type: 'root',
    version: 1,
    children: [para('a', 'first'), para('b', 'second'), para('c', 'third')],
    direction: null,
    format: '',
    indent: 0,
  },
} as SerializedEditorState

describe('buildSelectionXml', () => {
  it('is empty without a selection', () => {
    expect(buildSelectionXml(doc, null)).toBe('')
  })

  it('serializes selected blocks only', () => {
    const xml = buildSelectionXml(doc, { type: 'block', blockIds: ['b'] })

    expect(xml).toContain('second')
    expect(xml).not.toContain('first')
  })

  it('wraps selected text with the blocks it spans', () => {
    const xml = buildSelectionXml(doc, {
      type: 'text',
      text: 'cond & th',
      anchorBlockId: 'b',
      anchorOffset: 3,
      focusBlockId: 'c',
      focusOffset: 2,
    })

    expect(xml).toContain('<selected_text>cond &amp; th</selected_text>')
    expect(xml).toContain('second')
    expect(xml).toContain('third')
    expect(xml).not.toContain('first')
  })
})
