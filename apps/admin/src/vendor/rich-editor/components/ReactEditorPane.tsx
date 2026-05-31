import './setup-enrichment-linkcard'
import '@haklex/rich-ext-ai-agent/style.css'
import '@haklex/rich-ext-nested-doc/style.css'
import '../core/style'

import type {
  AgentStore,
  AgentToolConfig,
  ChatMessage,
  LLMProvider,
} from '@haklex/rich-agent-core'
import { DialogStackProvider } from '@haklex/rich-editor-ui'
import {
  AgentAskAIAction,
  AgentDiffEditNode,
  AgentSelectionPinPlugin,
  DiffReviewOverlayPlugin,
} from '@haklex/rich-ext-ai-agent'
import { ExcalidrawConfigProvider } from '@haklex/rich-ext-excalidraw'
import {
  NestedDocDialogEditorProvider,
  nestedDocEditNodes,
  NestedDocPlugin,
} from '@haklex/rich-ext-nested-doc'
import type { LexicalEditor } from 'lexical'
import { useRef } from 'react'

import type { RichEditorProps } from '../core'
import { RichEditor } from '../core'
import type { AgentLoopHandle, SaveExcalidrawSnapshot } from '../types'
import { AgentLoopCapture } from './AgentLoopCapture'
import { EditorToolbar } from './EditorToolbar'
import type { EnrichmentFetcher } from './EnrichmentLinkCardContext'
import { EnrichmentFetcherProvider } from './EnrichmentLinkCardContext'
import { NestedDocDialogEditor } from './NestedDocDialogEditor'

export interface ReactEditorPaneProps {
  editorProps: Omit<RichEditorProps, 'onChange' | 'onSubmit' | 'onEditorReady'>
  store: AgentStore
  provider: LLMProvider | null
  saveExcalidrawSnapshot: SaveExcalidrawSnapshot
  apiUrl: string
  fetchEnrichment?: EnrichmentFetcher | null
  onChange?: RichEditorProps['onChange']
  onSubmit?: RichEditorProps['onSubmit']
  onEditorReady?: (editor: LexicalEditor | null) => void
  onAgentLoopReady: (loop: AgentLoopHandle | null) => void
  tools?: AgentToolConfig[]
  systemMessages?: ChatMessage[]
}

export function ReactEditorPane({
  editorProps,
  store,
  provider,
  saveExcalidrawSnapshot,
  apiUrl,
  fetchEnrichment,
  onChange,
  onSubmit,
  onEditorReady,
  onAgentLoopReady,
  tools,
  systemMessages,
}: ReactEditorPaneProps) {
  const editorRef = useRef<LexicalEditor | null>(null)

  const handleEditorReady = (editor: LexicalEditor | null) => {
    editorRef.current = editor
    onEditorReady?.(editor)
  }

  return (
    <EnrichmentFetcherProvider value={fetchEnrichment ?? null}>
      <NestedDocDialogEditorProvider value={NestedDocDialogEditor}>
        <DialogStackProvider>
          <ExcalidrawConfigProvider
            saveSnapshot={saveExcalidrawSnapshot}
            apiUrl={apiUrl}
          >
            <RichEditor
              {...editorProps}
              extraNodes={[
                ...(editorProps.extraNodes || []),
                ...nestedDocEditNodes,
                AgentDiffEditNode,
              ]}
              header={<EditorToolbar />}
              floatingToolbarActions={
                provider ? <AgentAskAIAction /> : undefined
              }
              onChange={onChange}
              onSubmit={onSubmit}
              onEditorReady={handleEditorReady}
            >
              <DiffReviewOverlayPlugin store={store} />
              {provider ? <AgentSelectionPinPlugin store={store} /> : null}
              <AgentLoopCapture
                editorRef={editorRef}
                onAgentLoopReady={onAgentLoopReady}
                provider={provider}
                store={store}
                tools={tools}
                systemMessages={systemMessages}
              />
              <NestedDocPlugin />
            </RichEditor>
          </ExcalidrawConfigProvider>
        </DialogStackProvider>
      </NestedDocDialogEditorProvider>
    </EnrichmentFetcherProvider>
  )
}
