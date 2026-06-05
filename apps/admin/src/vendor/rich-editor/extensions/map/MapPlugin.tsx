import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $insertNodes, COMMAND_PRIORITY_EDITOR } from 'lexical'
import { useEffect } from 'react'

import { presentInsertMapDialog } from './InsertMapDialog'
import {
  registerMapDialogOpener,
  unregisterMapDialogOpener,
} from './map-plugin-bridge'
import {
  $createMapNode,
  INSERT_MAP_COMMAND,
  type MapNodePayload,
} from './MapNode'

export function MapPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    registerMapDialogOpener(editor, (payload) => {
      void presentInsertMapDialog({
        initial: payload.initial,
        onSubmit: (next) => payload.onSubmit(next),
      })
    })
    return () => unregisterMapDialogOpener(editor)
  }, [editor])

  useEffect(() => {
    return editor.registerCommand<MapNodePayload>(
      INSERT_MAP_COMMAND,
      (payload) => {
        editor.update(() => {
          const node = $createMapNode(payload)
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
