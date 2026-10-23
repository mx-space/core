import { INSERT_DYNAMIC_COMMAND } from '@haklex/rich-ext-dynamic'
import type { LexicalEditor } from 'lexical'
import { $insertNodes, COMMAND_PRIORITY_HIGH } from 'lexical'

import { $createCatalogDynamicEditNode } from './CatalogDynamicEditNode'

export function registerDynamicInsertCommand(editor: LexicalEditor) {
  return editor.registerCommand(
    INSERT_DYNAMIC_COMMAND,
    (payload) => {
      $insertNodes([$createCatalogDynamicEditNode(payload ?? {})])
      return true
    },
    COMMAND_PRIORITY_HIGH,
  )
}
