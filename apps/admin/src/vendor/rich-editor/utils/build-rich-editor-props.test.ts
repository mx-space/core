// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { buildRichEditorProps } from './build-rich-editor-props'

vi.mock('@haklex/rich-editor', () => ({}))
vi.mock('../core', () => ({}))

describe('buildRichEditorProps', () => {
  it('copies defined editor props and maps editorStyle to style', () => {
    const result = buildRichEditorProps('dark', {
      autoFocus: true,
      className: 'editor-shell',
      contentClassName: 'editor-content',
      debounceMs: 120,
      editorStyle: { minHeight: 120 },
      extraNodes: ['node-a'] as any,
      imageUpload: (() => Promise.resolve('ok')) as any,
      initialValue: {
        root: {
          children: [],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      } as any,
      placeholder: 'Write here',
      selfHostnames: ['mx-space.local'],
      variant: 'article',
    })

    expect(result).toMatchObject({
      autoFocus: true,
      className: 'editor-shell',
      contentClassName: 'editor-content',
      debounceMs: 120,
      extraNodes: ['node-a'],
      imageUpload: expect.any(Function),
      placeholder: 'Write here',
      selfHostnames: ['mx-space.local'],
      style: { minHeight: 120 },
      theme: 'dark',
      variant: 'article',
    })
    expect(result).not.toHaveProperty('editorStyle')
  })

  it('omits undefined values', () => {
    const result = buildRichEditorProps('light', {
      className: 'editor-shell',
      editorStyle: undefined,
      placeholder: undefined,
    })

    expect(result).toEqual({
      className: 'editor-shell',
      theme: 'light',
    })
  })
})
