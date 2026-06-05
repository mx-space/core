import type { LexicalEditor } from 'lexical'

export interface MapDialogPayload {
  initial?: MapNodePayload
  onSubmit: (payload: MapNodePayload) => void
}

export interface MapNodePayload {
  pois?: import('./types').MapPoi[]
  title: string
  track?: { url: string }
  view?: import('./types').MapView
}

export type MapDialogOpener = (payload: MapDialogPayload) => void

const bridge = new WeakMap<LexicalEditor, MapDialogOpener>()

export function registerMapDialogOpener(
  editor: LexicalEditor,
  open: MapDialogOpener,
) {
  bridge.set(editor, open)
}

export function unregisterMapDialogOpener(editor: LexicalEditor) {
  bridge.delete(editor)
}

export function openMapDialog(
  editor: LexicalEditor,
  payload: MapDialogPayload,
) {
  const opener = bridge.get(editor)
  if (opener) opener(payload)
}
