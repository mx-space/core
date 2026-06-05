import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNodeByKey } from 'lexical'
import { Pencil } from 'lucide-react'

import { useThemeMode } from '~/theme'

import type { MapSlotProps } from './map-augment'
import { openMapDialog } from './map-plugin-bridge'
import { MapBlock } from './MapBlock'
import { $isMapNode, type MapNodePayload } from './MapNode'

export function MapBlockConnected(props: MapSlotProps) {
  const { isDark } = useThemeMode()
  const [editor] = useLexicalComposerContext()

  const handleEdit = () => {
    if (!props.nodeKey) return
    let initial: MapNodePayload | null = null
    editor.getEditorState().read(() => {
      const node = $getNodeByKey(props.nodeKey!)
      if ($isMapNode(node)) initial = node.getPayload()
    })
    if (!initial) return
    openMapDialog(editor, {
      initial,
      onSubmit: (next) => {
        editor.update(() => {
          const node = $getNodeByKey(props.nodeKey!)
          if ($isMapNode(node)) node.setPayload(next)
        })
      },
    })
  }

  return (
    <div className="group relative">
      <MapBlock
        isDark={isDark}
        pois={props.pois}
        src={props.track?.url}
        title={props.title}
        view={props.view}
      />
      {props.nodeKey && editor.isEditable() && (
        <button
          type="button"
          aria-label="Edit map"
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
