// @vitest-environment node

import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { RichEditorBridge } from './RichEditorBridge'

vi.mock('@haklex/rich-editor-ui', async () => {
  const { createElement } = await import('react')

  return {
    DialogStackProvider: (props: any) =>
      createElement('dialog-stack-provider', props, props.children),
  }
})

vi.mock('@haklex/rich-ext-nested-doc', async () => {
  const { createElement } = await import('react')

  return {
    NestedDocDialogEditorProvider: (props: any) =>
      createElement('nested-doc-dialog-provider', props, props.children),
    NestedDocPlugin: () => createElement('nested-doc-plugin'),
    nestedDocEditNodes: ['nested-a', 'nested-b'],
  }
})

vi.mock('@haklex/rich-ext-excalidraw', async () => {
  const { createElement } = await import('react')

  return {
    ExcalidrawConfigProvider: (props: any) =>
      createElement('excalidraw-config-provider', props, props.children),
  }
})

vi.mock('../core', async () => {
  const { createElement } = await import('react')

  return {
    enhancedEditRendererConfig: {},
    enhancedRendererConfig: {},
    RichEditor: (props: any) =>
      createElement('rich-editor', props, props.children),
  }
})

vi.mock('./EditorToolbar', async () => {
  const { createElement } = await import('react')

  return {
    EditorToolbar: () => createElement('editor-toolbar'),
  }
})

vi.mock('./setup-enrichment-linkcard', () => ({}))

describe('RichEditorBridge', () => {
  it('wraps the rich editor with shared providers and appends nested doc nodes', () => {
    const saveExcalidrawSnapshot = vi.fn(async () => 'ref:file/x')
    const apiUrl = 'https://api.test'

    const tree: any = RichEditorBridge({
      apiUrl,
      children: createElement('custom-child'),
      editorProps: {
        extraNodes: ['custom-node'] as any,
        theme: 'dark',
      } as any,
      onChange: vi.fn(),
      onEditorReady: vi.fn(),
      onSubmit: vi.fn(),
      saveExcalidrawSnapshot,
    })

    const enrichmentProvider = tree
    const dialogProvider = enrichmentProvider.props.children
    const stackProvider = dialogProvider.props.children
    const excalidrawProvider = stackProvider.props.children
    const richEditor = excalidrawProvider.props.children

    expect(enrichmentProvider.props.value).toBeNull()
    expect(dialogProvider.props.value).toBeTypeOf('function')
    expect(excalidrawProvider.props.apiUrl).toBe(apiUrl)
    expect(excalidrawProvider.props.saveSnapshot).toBe(saveExcalidrawSnapshot)
    expect(richEditor.props.extraNodes).toEqual([
      'custom-node',
      'nested-a',
      'nested-b',
    ])
    expect(richEditor.props.header.type).toBeTypeOf('function')
    expect(richEditor.props.children.type).toBe('custom-child')
  })
})
