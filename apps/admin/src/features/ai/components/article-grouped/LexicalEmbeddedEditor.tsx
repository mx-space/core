import type { SerializedEditorState } from 'lexical'

import { DialogStackProvider } from '@haklex/rich-editor-ui'
import {
  NestedDocDialogEditorProvider,
  nestedDocEditNodes,
} from '@haklex/rich-ext-nested-doc'

import { NestedDocDialogEditor } from '~/vendor/rich-editor/components/NestedDocDialogEditor'
import { RichEditor } from '~/vendor/rich-editor/core'

interface LexicalEmbeddedEditorProps {
  autoFocus?: boolean
  contentClassName?: string
  initialValue?: SerializedEditorState
  onChange?: (value: SerializedEditorState) => void
}

export function LexicalEmbeddedEditor(props: LexicalEmbeddedEditorProps) {
  return (
    <DialogStackProvider>
      <NestedDocDialogEditorProvider value={NestedDocDialogEditor}>
        <RichEditor
          autoFocus={props.autoFocus}
          contentClassName={props.contentClassName}
          extraNodes={nestedDocEditNodes}
          initialValue={props.initialValue}
          onChange={props.onChange}
          variant="article"
        />
      </NestedDocDialogEditorProvider>
    </DialogStackProvider>
  )
}

export default LexicalEmbeddedEditor
