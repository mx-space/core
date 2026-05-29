import { EditorView } from '@codemirror/view'

export const wysiwygMeasureExtension = EditorView.updateListener.of(
  (update) => {
    if (!update.selectionSet) return
    update.view.requestMeasure()
  },
)
