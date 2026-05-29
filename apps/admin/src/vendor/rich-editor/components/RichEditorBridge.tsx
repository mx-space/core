import type { LexicalEditor } from 'lexical'
import type { ReactNode } from 'react'
import type { RichEditorProps } from '../core'
import type { SaveExcalidrawSnapshot } from '../types'
import type { EnrichmentFetcher } from './EnrichmentLinkCardContext'

import { DialogStackProvider } from '@haklex/rich-editor-ui'
import { ExcalidrawConfigProvider } from '@haklex/rich-ext-excalidraw'
import {
  NestedDocDialogEditorProvider,
  nestedDocEditNodes,
} from '@haklex/rich-ext-nested-doc'

import { RichEditor } from '../core'
import { EditorToolbar } from './EditorToolbar'
import { EnrichmentFetcherProvider } from './EnrichmentLinkCardContext'
import { NestedDocDialogEditor } from './NestedDocDialogEditor'

import './setup-enrichment-linkcard'

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
          <ExcalidrawConfigProvider
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
              {children}
            </RichEditor>
          </ExcalidrawConfigProvider>
        </DialogStackProvider>
      </NestedDocDialogEditorProvider>
    </EnrichmentFetcherProvider>
  )
}
