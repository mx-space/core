import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $insertNodes, COMMAND_PRIORITY_EDITOR } from 'lexical'
import { useEffect } from 'react'

import {
  registerAfilmoryDialogOpener,
  unregisterAfilmoryDialogOpener,
} from './afilmory-bridge'
import {
  $createAfilmoryNode,
  type AfilmoryPayload,
  INSERT_AFILMORY_COMMAND,
} from './AfilmoryNode'
import { presentInsertAfilmoryDialog } from './InsertAfilmoryDialog'

export function AfilmoryPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    registerAfilmoryDialogOpener(editor, (payload) => {
      void presentInsertAfilmoryDialog({
        initial: payload.initial,
        onSubmit: (next) => payload.onSubmit(next),
      })
    })
    return () => unregisterAfilmoryDialogOpener(editor)
  }, [editor])

  useEffect(() => {
    return editor.registerCommand<AfilmoryPayload>(
      INSERT_AFILMORY_COMMAND,
      (payload) => {
        editor.update(() => {
          const node = $createAfilmoryNode(payload)
          const selection = $getSelection()
          if (selection) $insertNodes([node])
        })
        return true
      },
      COMMAND_PRIORITY_EDITOR,
    )
  }, [editor])

  return null
}
