import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNodeByKey } from 'lexical'
import { Pencil } from 'lucide-react'

import type { AfilmorySlotProps } from './afilmory-augment'
import { type AfilmoryPayload, openAfilmoryDialog } from './afilmory-bridge'
import { AfilmoryBlock } from './AfilmoryBlock'
import { $isAfilmoryNode } from './AfilmoryNode'

export function AfilmoryBlockConnected(props: AfilmorySlotProps) {
  const [editor] = useLexicalComposerContext()

  const handleEdit = () => {
    if (!props.nodeKey) return
    let initial: AfilmoryPayload | null = null
    editor.getEditorState().read(() => {
      const node = $getNodeByKey(props.nodeKey!)
      if ($isAfilmoryNode(node)) initial = node.getPayload()
    })
    if (!initial) return
    openAfilmoryDialog(editor, {
      initial,
      onSubmit: (next) => {
        editor.update(() => {
          const node = $getNodeByKey(props.nodeKey!)
          if ($isAfilmoryNode(node)) node.setPayload(next)
        })
      },
    })
  }

  return (
    <div className="group relative">
      <AfilmoryBlock {...props} />
      {props.nodeKey && editor.isEditable() && (
        <button
          aria-label="Edit afilmory"
          className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-md border border-zinc-300/80 bg-white/90 px-2 py-1 text-xs font-medium text-zinc-700 opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-zinc-50"
          onClick={handleEdit}
          type="button"
        >
          <Pencil className="size-3" />
          Edit
        </button>
      )}
    </div>
  )
}
