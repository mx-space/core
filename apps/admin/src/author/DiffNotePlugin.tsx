import '@haklex/rich-ext-ai-agent/style.css'

import {
  type AgentDiffNodePayload,
  setAgentDiffReviewController,
} from '@haklex/rich-ext-ai-agent'
import { $isAgentDiffNode } from '@haklex/rich-ext-ai-agent/static'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNodeByKey, $getRoot, $parseSerializedNode } from 'lexical'
import { useEffect } from 'react'

type Side = 'accepted' | 'rejected'

const pick = (payload: AgentDiffNodePayload, side: Side) =>
  side === 'accepted' ? payload.proposedNode : payload.originalNode

const $resolve = (nodeKey: string, side: Side) => {
  const node = $getNodeByKey(nodeKey)
  if (!$isAgentDiffNode(node)) return
  const picked = pick(node.getPayload(), side)
  if (picked) node.replace($parseSerializedNode(picked))
  else node.remove()
}

const $resolveAll = (side: Side) => {
  for (const child of $getRoot().getChildren()) {
    if ($isAgentDiffNode(child)) $resolve(child.getKey(), side)
  }
}

export function DiffNotePlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    setAgentDiffReviewController(editor, {
      acceptNode: (nodeKey) =>
        editor.update(() => $resolve(nodeKey, 'accepted')),
      rejectNode: (nodeKey) =>
        editor.update(() => $resolve(nodeKey, 'rejected')),
      acceptBatch: () => editor.update(() => $resolveAll('accepted')),
      rejectBatch: () => editor.update(() => $resolveAll('rejected')),
    })
    return () => setAgentDiffReviewController(editor, null)
  }, [editor])

  return null
}
