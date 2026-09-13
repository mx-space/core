import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import type { SerializedEditorState } from 'lexical'
import { $getRoot, $parseSerializedNode } from 'lexical'
import type { MutableRefObject } from 'react'
import { useEffect } from 'react'

import { blocksOf, mergeRevision, resolveToProposed } from './merge'

export interface RevisionInfo {
  revision: number
  conflicts: number
}

interface Props {
  base: MutableRefObject<ReturnType<typeof blocksOf>>
  onRevision: (info: RevisionInfo) => void
}

export function RevisionSyncPlugin({ base, onRevision }: Props) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const source = new EventSource('/api/events')
    source.addEventListener('revision', (event) => {
      const { revision, lexical } = JSON.parse(
        (event as MessageEvent<string>).data,
      ) as { revision: number; lexical: SerializedEditorState }
      const local = blocksOf(editor.getEditorState().toJSON())
      const remote = blocksOf(editor.parseEditorState(lexical).toJSON())
      const merged = mergeRevision(base.current, local, remote)
      editor.update(() => {
        const root = $getRoot()
        root.clear()
        for (const block of merged.children) {
          root.append($parseSerializedNode(block))
        }
      })
      base.current = resolveToProposed(merged.children)
      const info = { revision, conflicts: merged.conflicts }
      onRevision(info)
      void fetch('/api/ack', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(info),
      })
    })
    return () => source.close()
  }, [editor, base, onRevision])

  return null
}
