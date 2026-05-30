import { Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { useI18n } from '~/i18n'
import { Scroll } from '~/ui/primitives/scroll'

import { AgentMessageItem } from './messages'
import type {
  AgentStreamStatus,
  AgentToolCallFinal,
  AssistantChatMessage,
  ChatMessageEntry,
} from './types'
import { TypingIndicator } from './TypingIndicator'

interface MessageListProps {
  messages: ChatMessageEntry[]
  isHydrating: boolean
  streamStatus: AgentStreamStatus
  onToolCallEnd?: (toolCall: AgentToolCallFinal) => void
}

function pickStreamingAssistant(messages: ChatMessageEntry[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const candidate = messages[i]
    if (candidate.role !== 'assistant') continue
    if (candidate.blocks.some((b) => b.status === 'streaming')) {
      return candidate as AssistantChatMessage
    }
    break
  }
  return null
}

export function MessageList(props: MessageListProps) {
  const { t } = useI18n()
  const { messages, isHydrating, streamStatus, onToolCallEnd } = props

  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  }, [messages])

  const streamingAssistant = pickStreamingAssistant(messages)
  const showTyping =
    streamStatus === 'connecting' ||
    streamStatus === 'streaming' ||
    Boolean(streamingAssistant)

  return (
    <Scroll className="min-h-0 flex-1" innerClassName="p-3" ref={viewportRef}>
      {isHydrating ? (
        <div className="flex h-28 items-center justify-center gap-2 text-xs text-neutral-500">
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          {t('write.agent.hydrating')}
        </div>
      ) : messages.length === 0 ? (
        <p className="text-xs leading-5 text-neutral-500">
          {t('write.agent.empty')}
        </p>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <AgentMessageItem
              key={message.id}
              message={message}
              onToolCallEnd={onToolCallEnd}
            />
          ))}
          {showTyping ? (
            <TypingIndicator
              blocks={streamingAssistant ? streamingAssistant.blocks : null}
            />
          ) : null}
          {streamStatus === 'connection_lost' ? (
            <div className="text-xs leading-relaxed text-amber-600 dark:text-amber-400">
              connection lost
            </div>
          ) : null}
        </div>
      )}
    </Scroll>
  )
}
