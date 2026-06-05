import type { LexicalEditor } from 'lexical'

import type { AfilmoryLayout, AfilmorySource } from './afilmory-augment'

export interface AfilmoryPayload {
  baseUrl: string
  source: AfilmorySource
  layout?: AfilmoryLayout
  title?: string
  caption?: string
  alt?: string
  accent?: string
  limit?: number
}

export interface AfilmoryDialogPayload {
  initial?: AfilmoryPayload
  onSubmit: (payload: AfilmoryPayload) => void
}

export type AfilmoryDialogOpener = (payload: AfilmoryDialogPayload) => void

const bridge = new WeakMap<LexicalEditor, AfilmoryDialogOpener>()

export function registerAfilmoryDialogOpener(
  editor: LexicalEditor,
  open: AfilmoryDialogOpener,
) {
  bridge.set(editor, open)
}

export function unregisterAfilmoryDialogOpener(editor: LexicalEditor) {
  bridge.delete(editor)
}

export function openAfilmoryDialog(
  editor: LexicalEditor,
  payload: AfilmoryDialogPayload,
) {
  const opener = bridge.get(editor)
  if (opener) opener(payload)
}
