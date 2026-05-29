import type { EditorState } from '@codemirror/state'

export type RenderMode = 'plain' | 'wysiwyg'

export interface EditorBaseProps {
  text: string
  onChange: (value: string) => void
  renderMode?: RenderMode
  unSaveConfirm?: boolean
  saveConfirmFn?: () => boolean
  onStateChange?: (state: EditorState) => void
}
