import type { LexicalEditor } from 'lexical'

import type { MapNodePayload } from './map-plugin-bridge'

export interface LocationDialogPayload {
  initial?: MapNodePayload
  onSubmit: (payload: MapNodePayload) => void
}

export type LocationDialogOpener = (payload: LocationDialogPayload) => void

const bridge = new WeakMap<LexicalEditor, LocationDialogOpener>()

export function registerLocationDialogOpener(
  editor: LexicalEditor,
  open: LocationDialogOpener,
) {
  bridge.set(editor, open)
}

export function unregisterLocationDialogOpener(editor: LexicalEditor) {
  bridge.delete(editor)
}

export function openLocationDialog(
  editor: LexicalEditor,
  payload: LocationDialogPayload,
) {
  const opener = bridge.get(editor)
  if (opener) opener(payload)
}
