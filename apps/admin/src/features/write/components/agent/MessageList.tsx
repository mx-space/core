import type { AgentStore, ToolCallGroupItem } from '@haklex/rich-agent-core'
import { agentStoreSelectors } from '@haklex/rich-agent-core'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useStore } from 'zustand'

import { useI18n } from '~/i18n'
import { Scroll } from '~/ui/primitives/scroll'

import { getAgentBubbleKey } from './agent-operations'
import { AgentMessageItem } from './messages'

interface MessageListProps {
  store: AgentStore
  isHydrating: boolean
  onReapplyToolGroup: (items: ToolCallGroupItem[]) => void
}

export function MessageList(props: MessageListProps) {
  const { t } = useI18n()
  const { store } = props

  const bubbles = useStore(store, agentStoreSelectors.bubbles)
  const status = useStore(store, agentStoreSelectors.status)

  const viewportRef = useRef<HTMLDivElement>(null)

  const actionsLocked = status !== 'idle' && status !== 'done'

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  }, [bubbles])

  return (
    <Scroll className="min-h-0 flex-1" innerClassName="p-3" ref={viewportRef}>
      {props.isHydrating ? (
        <div className="flex h-28 items-center justify-center gap-2 text-xs text-neutral-500">
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          {t('write.agent.hydrating')}
        </div>
      ) : bubbles.length === 0 ? (
        <p className="text-xs leading-5 text-neutral-500">
          {t('write.agent.empty')}
        </p>
      ) : (
        <div className="space-y-3">
          {bubbles.map((bubble, index) => (
            <AgentMessageItem
              key={getAgentBubbleKey(bubble, index)}
              actionsLocked={actionsLocked}
              bubble={bubble}
              onReapplyToolGroup={props.onReapplyToolGroup}
            />
          ))}
        </div>
      )}
    </Scroll>
  )
}
