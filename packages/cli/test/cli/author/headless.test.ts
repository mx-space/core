import { $getRoot, type DecoratorNode } from 'lexical'
import { describe, expect, it } from 'vitest'

import { createAuthorHeadlessEditor } from '../../../src/cli/author/headless'

describe('createAuthorHeadlessEditor', () => {
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
