import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNodeByKey } from 'lexical'
import { Pencil } from 'lucide-react'

import type { StockSlotProps } from './stock-augment'
import { openStockDialog } from './stock-plugin-bridge'
import { StockBlock } from './StockBlock'
import { $isStockNode, type StockNodePayload } from './StockNode'

export function StockBlockConnected(props: StockSlotProps) {
  const [editor] = useLexicalComposerContext()

  const handleEdit = () => {
    if (!props.nodeKey) return
    const payload = editor
      .getEditorState()
      .read<StockNodePayload | null>(() => {
        const node = $getNodeByKey(props.nodeKey!)
        return $isStockNode(node) ? node.getPayload() : null
      })
    if (!payload) return
    openStockDialog(editor, {
      initial: payload,
      variant: payload.variant,
      onSubmit: (next) => {
        editor.update(() => {
          const node = $getNodeByKey(props.nodeKey!)
          if ($isStockNode(node)) node.setPayload(next)
        })
      },
    })
  }

  return (
    <div className="group relative font-sans">
      <StockBlock {...props} />
      {props.nodeKey && editor.isEditable() && (
        <button
          type="button"
          aria-label="Edit stock"
          className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-md border border-zinc-300/80 bg-white/90 px-2 py-1 text-xs font-medium text-zinc-700 opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-zinc-50"
          onClick={handleEdit}
        >
          <Pencil className="size-3" />
          Edit
        </button>
      )}
    </div>
  )
}
