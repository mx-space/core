import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'

import { registerDynamicInsertCommand } from './insert-command'

export function DynamicInsertPlugin() {
  const [editor] = useLexicalComposerContext()
  useEffect(() => registerDynamicInsertCommand(editor), [editor])
  return null
}
