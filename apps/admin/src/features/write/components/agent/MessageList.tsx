import type { AgentStore, ToolCallGroupItem } from '@haklex/rich-agent-core'
import { agentStoreSelectors } from '@haklex/rich-agent-core'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'

import { useI18n } from '~/i18n'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { getAgentBubbleKey } from './agent-operations'
import { segmentBubbles } from './agent-process'
import { AgentMessageItem } from './messages'
import { ProcessTrace } from './ProcessTrace'

interface MessageListProps {
  store: AgentStore
  isHydrating: boolean
  onAcceptBatch: (batchId: string) => void
  onRejectBatch: (batchId: string) => void
  onReapplyBatch: (batchId: string) => void
  onReapplyToolGroup: (items: ToolCallGroupItem[]) => void
}

export function MessageList(props: MessageListProps) {
  const { t } = useI18n()
  const { store } = props

  const bubbles = useStore(store, agentStoreSelectors.bubbles)
  const reviewState = useStore(store, agentStoreSelectors.reviewState)
  const status = useStore(store, agentStoreSelectors.status)

  const viewportRef = useRef<HTMLDivElement>(null)

  const actionsLocked = status !== 'idle' && status !== 'done'

  // The stream seeds the diff_review card at the first op, before the reply
  // finishes. Move each card to the end of its own turn (delimited by the
  // next user bubble) so multi-turn sessions keep cards next to their turn.
  const orderedBubbles: { bubble: (typeof bubbles)[number]; index: number }[] =
    []
  let deferredReviews: typeof orderedBubbles = []
  for (const [index, bubble] of bubbles.entries()) {
    if (bubble.type === 'user') {
      orderedBubbles.push(...deferredReviews)
      deferredReviews = []
    }
    if (bubble.type === 'diff_review') deferredReviews.push({ bubble, index })
    else orderedBubbles.push({ bubble, index })
  }
  orderedBubbles.push(...deferredReviews)
  const segments = segmentBubbles(orderedBubbles)
  let liveIndex = -1
  if (actionsLocked) {
    for (let i = segments.length - 1; i >= 0; i--) {
      const segment = segments[i]
      if (segment.kind === 'process') liveIndex = i
      if (
        segment.kind === 'process' ||
        segment.entry.bubble.type !== 'diff_review'
      )
        break
    }
  }

  const keyed = segments.map((segment, position) => {
    const first =
      segment.kind === 'process' ? segment.entries[0] : segment.entry
    const key = getAgentBubbleKey(first.bubble, first.index)
    return {
      key: segment.kind === 'process' ? `process:${key}` : key,
      position,
      segment,
    }
  })

  // Bubble keys are index-based, so a new or switched conversation reuses the
  // previous one's keys; the first bubble's identity tells the two apart.
  const anchor = bubbles[0]
  const [baseline, setBaseline] = useState<{
    anchor: (typeof bubbles)[number] | undefined
    keys: Set<string>
  } | null>(null)
  useEffect(() => {
    if (props.isHydrating) {
      if (baseline) setBaseline(null)
      return
    }
    const switched =
      baseline && (baseline.anchor ? baseline.anchor !== anchor : false)
    if (!baseline || switched) {
      setBaseline({ anchor, keys: new Set(keyed.map((item) => item.key)) })
    } else if (!baseline.anchor && anchor) {
      setBaseline({ anchor, keys: baseline.keys })
    }
  })
  const entering = (key: string) =>
    Boolean(
      baseline &&
      !baseline.keys.has(key) &&
      (!baseline.anchor || baseline.anchor === anchor),
    )

  const getBatch = (id: string) =>
    reviewState?.batches.find((batch) => batch.id === id)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  }, [bubbles])

  return (
    <Scroll
      className="min-h-0 flex-1"
      innerClassName="px-4 py-4"
      ref={viewportRef}
    >
      {props.isHydrating ? (
        <div className="flex h-28 items-center justify-center gap-2 text-sm text-fg-muted">
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          {t('write.agent.hydrating')}
        </div>
      ) : bubbles.length === 0 ? (
        <p className="text-base leading-relaxed text-fg-muted">
          {t('write.agent.empty')}
        </p>
      ) : (
        <div className="space-y-3">
          {keyed.map(({ key, position, segment }) => {
            const enter = entering(key)
            if (segment.kind === 'process') {
              return (
                <div
                  className={cn(enter && 'agent-enter')}
                  data-agent-enter={enter ? '' : undefined}
                  key={key}
                >
                  <ProcessTrace
                    bubbles={segment.entries.map((entry) => entry.bubble)}
                    live={position === liveIndex}
                    onReapply={props.onReapplyToolGroup}
                    reapplyDisabled={actionsLocked}
                  />
                </div>
              )
            }
            const { bubble } = segment.entry
            const isUser = bubble.type === 'user'
            return (
              <div
                className={cn(
                  isUser && position > 0 && 'pt-4',
                  enter && (isUser ? 'agent-enter-user' : 'agent-enter'),
                )}
                data-agent-enter={enter ? '' : undefined}
                key={key}
              >
                <AgentMessageItem
                  actionsLocked={actionsLocked}
                  bubble={bubble}
                  getBatch={getBatch}
                  onAcceptBatch={props.onAcceptBatch}
                  onRejectBatch={props.onRejectBatch}
                  onReapplyBatch={props.onReapplyBatch}
                />
              </div>
            )
          })}
        </div>
      )}
    </Scroll>
  )
}
