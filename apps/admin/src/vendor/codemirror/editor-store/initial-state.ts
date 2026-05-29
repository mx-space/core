import type { EditorView } from '@codemirror/view'

export interface EditorStoreState {
  editorView: EditorView | undefined
}

export const initialEditorStoreState: EditorStoreState = {
  editorView: undefined,
}
