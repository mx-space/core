import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $insertNodes, COMMAND_PRIORITY_EDITOR } from 'lexical'
import { useEffect } from 'react'

import { presentInsertStockDialog } from './InsertStockDialog'
import {
  registerStockDialogOpener,
  unregisterStockDialogOpener,
} from './stock-plugin-bridge'
import {
  $createStockNode,
  INSERT_STOCK_COMMAND,
  type StockNodePayload,
} from './StockNode'

export function StockPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    registerStockDialogOpener(editor, (payload) => {
      void presentInsertStockDialog({
        initial: payload.initial,
        variant: payload.variant,
        onSubmit: (next) => payload.onSubmit(next),
      })
    })
    return () => {
      unregisterStockDialogOpener(editor)
    }
  }, [editor])

  useEffect(() => {
    return editor.registerCommand<StockNodePayload>(
      INSERT_STOCK_COMMAND,
      (payload) => {
        editor.update(() => {
          const node = $createStockNode(payload)
          $insertNodes([node])
        })
        return true
      },
      COMMAND_PRIORITY_EDITOR,
    )
  }, [editor])

  return null
}
