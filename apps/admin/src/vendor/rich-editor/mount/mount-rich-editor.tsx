import { createRoot } from 'react-dom/client'
import type { LexicalEditor, SerializedEditorState } from 'lexical'
import type { EnrichmentFetcher } from '../components/EnrichmentLinkCardContext'
import type { SaveExcalidrawSnapshot } from '../types'
import type { BuildRichEditorPropsInput } from '../utils/build-rich-editor-props'

import { NestedDocPlugin } from '@haklex/rich-ext-nested-doc'
import { $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown'

import { RichEditorBridge } from '../components/RichEditorBridge'
import { buildRichEditorProps } from '../utils/build-rich-editor-props'

export interface MountRichEditorOptions extends BuildRichEditorPropsInput {
  theme: 'dark' | 'light'
  saveExcalidrawSnapshot: SaveExcalidrawSnapshot
  apiUrl: string
  fetchEnrichment?: EnrichmentFetcher | null
  onChange?: (value: SerializedEditorState) => void
  onSubmit?: () => void
  onEditorReady?: (editor: LexicalEditor | null) => void
  onTextChange?: (text: string) => void
}

export interface RichEditorHandle {
  update(opts: MountRichEditorOptions): void
  unmount(): void
  getEditor(): LexicalEditor | null
  focus(): void
}

export function mountRichEditor(
  container: HTMLElement,
  initial: MountRichEditorOptions,
): RichEditorHandle {
  const root = createRoot(container)
  let editorInstance: LexicalEditor | null = null
  let current = initial
  let unmounted = false

  const handleChange = (value: SerializedEditorState) => {
    if (unmounted) return
    current.onChange?.(value)
    if (editorInstance && current.onTextChange) {
      const cb = current.onTextChange
      editorInstance.read(() => cb($convertToMarkdownString(TRANSFORMERS)))
    }
  }

  const handleSubmit = () => {
    if (unmounted) return
    current.onSubmit?.()
  }

  const handleEditorReady = (editor: LexicalEditor | null) => {
    if (unmounted) return
    editorInstance = editor
    current.onEditorReady?.(editor)
    if (editor && current.onTextChange) {
      const cb = current.onTextChange
      editor.read(() => cb($convertToMarkdownString(TRANSFORMERS)))
    }
  }

  const render = (opts: MountRichEditorOptions) => {
    const editorProps = buildRichEditorProps(opts.theme, opts)
    root.render(
      <RichEditorBridge
        editorProps={editorProps}
        saveExcalidrawSnapshot={opts.saveExcalidrawSnapshot}
        apiUrl={opts.apiUrl}
        fetchEnrichment={opts.fetchEnrichment}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onEditorReady={handleEditorReady}
      >
        <NestedDocPlugin />
      </RichEditorBridge>,
    )
  }

  render(initial)

  return {
    update(opts) {
      current = opts
      render(opts)
    },
    unmount() {
      unmounted = true
      root.unmount()
      editorInstance = null
    },
    getEditor() {
      return editorInstance
    },
    focus() {
      editorInstance?.focus()
    },
  }
}
