import { createLoroBinding, type LoroBinding } from '@haklex/rich-collab-loro'
import type { LexicalEditor } from 'lexical'
import { LoroDoc } from 'loro-crdt'

import type { ApiRequestError } from '~/api/http'

import {
  type CrdtSyncStatus,
  type CrdtTransport,
  createCrdtSync,
} from './crdt-sync'

const HUMAN_MESSAGE = 'human:owner'
const TITLE = 'title'

export interface CrdtDraftSessionOptions {
  onRejected?: (error: ApiRequestError) => void
  onRemoteTitle?: (title: string) => void
  onStatus?: (status: CrdtSyncStatus) => void
  transport: CrdtTransport
}

export interface BindOptions {
  adopt?: boolean
}

export interface CrdtDraftSession {
  bindEditor: (editor: LexicalEditor | null, options?: BindOptions) => void
  dispose: () => void
  flush: () => Promise<void>
  pending: () => boolean
  pull: () => Promise<void>
  setCommitMessage: (message: string | null) => void
  setTitle: (title: string) => void
}

export async function createCrdtDraftSession(
  options: CrdtDraftSessionOptions,
): Promise<CrdtDraftSession> {
  const doc = new LoroDoc()
  doc.setRecordTimestamp(true)
  // The binding reads `commitMessage` on every commit, so mutating it relabels later edits.
  const bindingOptions = { commitMessage: HUMAN_MESSAGE }
  let binding: LoroBinding | null = null
  let lastTitle: string | null = null

  const reportTitle = () => {
    const title = doc.getText(TITLE).toString()
    if (title === lastTitle) return
    lastTitle = title
    options.onRemoteTitle?.(title)
  }

  const sync = await createCrdtSync({
    apply: (bytes) => {
      if (binding) binding.import(bytes)
      else doc.import(bytes)
      reportTitle()
    },
    doc,
    onRejected: options.onRejected,
    onStatus: options.onStatus,
    transport: options.transport,
  })
  reportTitle()

  return {
    bindEditor: (editor, bind) => {
      binding?.dispose()
      binding = null
      if (!editor) return
      const kept = bind?.adopt ? editor.getEditorState() : null
      binding = createLoroBinding(editor, doc, bindingOptions)
      if (kept) editor.setEditorState(kept)
    },
    dispose: () => {
      binding?.dispose()
      binding = null
      sync.dispose()
    },
    flush: () => sync.flush(),
    pending: () => sync.pending(),
    pull: () => sync.pull(),
    setCommitMessage: (message) => {
      bindingOptions.commitMessage = message ?? HUMAN_MESSAGE
    },
    setTitle: (title) => {
      const text = doc.getText(TITLE)
      if (text.toString() === title) return
      lastTitle = title
      text.update(title)
      doc.commit({ message: bindingOptions.commitMessage })
    },
  }
}
