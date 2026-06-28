import type { LexicalEditor } from 'lexical'

import type { StockVariant } from './stock-augment'
import type { StockNodePayload } from './StockNode'

export interface StockDialogPayload {
  initial?: StockNodePayload
  onSubmit: (payload: StockNodePayload) => void
  variant?: StockVariant
}

export type StockDialogOpener = (payload: StockDialogPayload) => void

const bridge = new WeakMap<LexicalEditor, StockDialogOpener>()

export function registerStockDialogOpener(
  editor: LexicalEditor,
  open: StockDialogOpener,
) {
  bridge.set(editor, open)
}

export function unregisterStockDialogOpener(editor: LexicalEditor) {
  bridge.delete(editor)
}

export function openStockDialog(
  editor: LexicalEditor,
  payload: StockDialogPayload,
) {
  const opener = bridge.get(editor)
  if (opener) opener(payload)
}
