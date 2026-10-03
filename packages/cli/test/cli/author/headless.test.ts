import { $getRoot, type DecoratorNode } from 'lexical'
import { describe, expect, it } from 'vitest'

import { createAuthorHeadlessEditor } from '../../../src/cli/author/headless'

describe('createAuthorHeadlessEditor', () => {
  it('keeps admin-only map blocks verbatim', () => {
    const map = {
      type: 'map',
      version: 1,
      title: 'Japan',
      track: { url: 'assets/route.json' },
    }
    const state = createAuthorHeadlessEditor().parseEditorState({
      root: {
        type: 'root',
        version: 1,
        direction: null,
        format: '',
        indent: 0,
        children: [map],
      },
    } as never)

    expect(state.toJSON().root.children).toEqual([map])
  })

  it('keeps admin-only stock blocks verbatim', () => {
    const stock = {
      type: 'stock',
      version: 1,
      variant: 'kline',
      symbol: 'SMH',
      range: { interval: '1d', from: '2026-09-08', to: '2026-10-02' },
      ema: false,
    }
    const editor = createAuthorHeadlessEditor()
    const state = editor.parseEditorState({
      root: {
        type: 'root',
        version: 1,
        direction: null,
        format: '',
        indent: 0,
        children: [stock],
      },
    } as never)

    expect(state.toJSON().root.children).toEqual([stock])
    expect(
      state.read(() => $getRoot().getFirstChildOrThrow<DecoratorNode<null>>().isInline()),
    ).toBe(false)
  })
})
