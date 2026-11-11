import '@haklex/rich-plugin-agent-stream/style.css'
import './setup-enrichment-linkcard'

import { DialogStackProvider } from '@haklex/rich-editor-ui'
import {
  NestedDocDialogEditorProvider,
  nestedDocEditNodes,
} from '@haklex/rich-ext-nested-doc'
import { WhiteboardConfigProvider } from '@haklex/rich-ext-whiteboard'
import { AgentStreamPlugin } from '@haklex/rich-plugin-agent-stream'
import type { LexicalEditor } from 'lexical'
import type { ReactNode } from 'react'

import type { RichEditorProps } from '../core'
import { RichEditor } from '../core'
import type { SaveExcalidrawSnapshot } from '../types'
import { EditorToolbar } from './EditorToolbar'
import type { EnrichmentFetcher } from './EnrichmentLinkCardContext'
import { EnrichmentFetcherProvider } from './EnrichmentLinkCardContext'
import { NestedDocDialogEditor } from './NestedDocDialogEditor'

export interface RichEditorBridgeProps {
  editorProps: Omit<RichEditorProps, 'onChange' | 'onSubmit' | 'onEditorReady'>
  saveExcalidrawSnapshot: SaveExcalidrawSnapshot
  apiUrl: string
  onChange?: RichEditorProps['onChange']
  onSubmit?: RichEditorProps['onSubmit']
  onEditorReady?: (editor: LexicalEditor | null) => void
  fetchEnrichment?: EnrichmentFetcher | null
  children?: ReactNode
}

export function RichEditorBridge({
  editorProps,
  saveExcalidrawSnapshot,
  apiUrl,
  onChange,
  onSubmit,
  onEditorReady,
  fetchEnrichment,
  children,
}: RichEditorBridgeProps) {
  return (
    <EnrichmentFetcherProvider value={fetchEnrichment ?? null}>
      <NestedDocDialogEditorProvider value={NestedDocDialogEditor}>
        <DialogStackProvider>
          <WhiteboardConfigProvider
            saveSnapshot={saveExcalidrawSnapshot}
            apiUrl={apiUrl}
          >
            <RichEditor
              {...editorProps}
              extraNodes={[
                ...(editorProps.extraNodes || []),
                ...nestedDocEditNodes,
              ]}
              header={<EditorToolbar />}
              onChange={onChange}
              onSubmit={onSubmit}
              onEditorReady={onEditorReady}
            >
              <AgentStreamPlugin agentName="AI" />
              {children}
            </RichEditor>
          </WhiteboardConfigProvider>
        </DialogStackProvider>
      </NestedDocDialogEditorProvider>
    </EnrichmentFetcherProvider>
  )
}
