import type { NestedDocDialogEditorProps } from '@haklex/rich-ext-nested-doc'

import { nestedDocEditNodes } from '@haklex/rich-ext-nested-doc'

import { RichEditor } from '../core'
import { EditorToolbar } from './EditorToolbar'

export function NestedDocDialogEditor({
  initialValue,
  onEditorReady,
}: NestedDocDialogEditorProps) {
  return (
    <RichEditor
      initialValue={initialValue}
      onEditorReady={onEditorReady}
      extraNodes={nestedDocEditNodes}
      header={<EditorToolbar />}
    />
  )
}
