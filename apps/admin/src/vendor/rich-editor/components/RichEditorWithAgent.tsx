import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type {
  AgentStore,
  AgentToolConfig,
  ChatMessage,
  LLMProvider,
} from '@haklex/rich-agent-core'
import type { LexicalEditor, SerializedEditorState } from 'lexical'
import type { AgentLoopHandle, SaveExcalidrawSnapshot } from '../types'
import type { BuildRichEditorPropsInput } from '../utils/build-rich-editor-props'
import type { EnrichmentFetcher } from './EnrichmentLinkCardContext'

import { $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown'

import { buildRichEditorProps } from '../utils/build-rich-editor-props'
import { ReactEditorPane } from './ReactEditorPane'

export interface RichEditorWithAgentProps extends BuildRichEditorPropsInput {
  apiUrl: string
  fetchEnrichment?: EnrichmentFetcher | null
  onAgentLoopReady?: (loop: AgentLoopHandle | null) => void
  onChange?: (value: SerializedEditorState) => void
  onEditorReady?: (editor: LexicalEditor | null) => void
  onSubmit?: () => void
  onTextChange?: (text: string) => void
  provider: LLMProvider | null
  saveExcalidrawSnapshot: SaveExcalidrawSnapshot
  store: AgentStore
  systemMessages?: ChatMessage[]
  theme: 'dark' | 'light'
  tools?: AgentToolConfig[]
}

export interface RichEditorWithAgentRef {
  focus: () => void
  getEditor: () => LexicalEditor | null
}

export const RichEditorWithAgent = forwardRef<
  RichEditorWithAgentRef,
  RichEditorWithAgentProps
>(function RichEditorWithAgent(props, ref) {
  const editorInstanceRef = useRef<LexicalEditor | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const lastEmittedJsonRef = useRef(
    props.initialValue ? JSON.stringify(props.initialValue) : '',
  )
  const callbacksRef = useRef({
    onAgentLoopReady: props.onAgentLoopReady,
    onChange: props.onChange,
    onEditorReady: props.onEditorReady,
    onSubmit: props.onSubmit,
    onTextChange: props.onTextChange,
  })

  callbacksRef.current = {
    onAgentLoopReady: props.onAgentLoopReady,
    onChange: props.onChange,
    onEditorReady: props.onEditorReady,
    onSubmit: props.onSubmit,
    onTextChange: props.onTextChange,
  }

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editorInstanceRef.current?.focus(),
      getEditor: () => editorInstanceRef.current,
    }),
    [],
  )

  const emitTextChange = useCallback(() => {
    const editor = editorInstanceRef.current
    const onTextChange = callbacksRef.current.onTextChange
    if (!editor || !onTextChange) return

    editor.read(() => onTextChange($convertToMarkdownString(TRANSFORMERS)))
  }, [])

  const handleChange = useCallback(
    (value: SerializedEditorState) => {
      lastEmittedJsonRef.current = JSON.stringify(value)
      callbacksRef.current.onChange?.(value)
      emitTextChange()
    },
    [emitTextChange],
  )

  const handleSubmit = useCallback(() => {
    callbacksRef.current.onSubmit?.()
  }, [])

  const handleEditorReady = useCallback(
    (editor: LexicalEditor | null) => {
      editorInstanceRef.current = editor
      callbacksRef.current.onEditorReady?.(editor)
      emitTextChange()
    },
    [emitTextChange],
  )

  const handleAgentLoopReady = useCallback((loop: AgentLoopHandle | null) => {
    callbacksRef.current.onAgentLoopReady?.(loop)
  }, [])

  useEffect(() => {
    const nextJson = props.initialValue
      ? JSON.stringify(props.initialValue)
      : ''
    if (nextJson === lastEmittedJsonRef.current) return

    lastEmittedJsonRef.current = nextJson
    editorInstanceRef.current = null
    setEditorKey((value) => value + 1)
  }, [props.initialValue])

  const editorProps = buildRichEditorProps(props.theme, props)

  return (
    <ReactEditorPane
      apiUrl={props.apiUrl}
      editorProps={editorProps}
      fetchEnrichment={props.fetchEnrichment}
      key={editorKey}
      onAgentLoopReady={handleAgentLoopReady}
      onChange={handleChange}
      onEditorReady={handleEditorReady}
      onSubmit={handleSubmit}
      provider={props.provider}
      saveExcalidrawSnapshot={props.saveExcalidrawSnapshot}
      store={props.store}
      systemMessages={props.systemMessages}
      tools={props.tools}
    />
  )
})
