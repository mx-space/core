import { MarkdownRender } from '~/ui/primitives/markdown-render'

import { ThinkingBlock } from './ThinkingBlock'
import { ToolCallCard } from './ToolCallCard'
import type {
  AgentToolCallFinal,
  AssistantBlock,
  ChatMessageEntry,
} from './types'

interface AssistantBlocksProps {
  blocks: AssistantBlock[]
  onToolCallEnd?: (toolCall: AgentToolCallFinal) => void
}

function AssistantBlocks({ blocks, onToolCallEnd }: AssistantBlocksProps) {
  const ordered = [...blocks].sort((a, b) => a.contentIndex - b.contentIndex)

  return (
    <div className="flex flex-col gap-2">
      {ordered.map((block) => {
        const key = `${block.kind}:${block.contentIndex}`
        if (block.kind === 'text') {
          if (!block.text) return null
          return (
            <MarkdownRender
              className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200"
              key={key}
              text={block.text}
            />
          )
        }
        if (block.kind === 'thinking') {
          return <ThinkingBlock block={block} key={key} />
        }
        // tool call dispatch on transition to done — surfaced through onToolCallEnd
        if (
          block.status === 'done' &&
          block.toolCallId &&
          block.finalArgs &&
          onToolCallEnd
        ) {
          // Render-time side effects are unwanted; the parent ensures dispatch
          // happens on event delivery. Card is still rendered below.
        }
        return <ToolCallCard block={block} key={key} />
      })}
    </div>
  )
}

interface AgentMessageItemProps {
  message: ChatMessageEntry
  onToolCallEnd?: (toolCall: AgentToolCallFinal) => void
}

export function AgentMessageItem({
  message,
  onToolCallEnd,
}: AgentMessageItemProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] whitespace-pre-wrap break-words bg-neutral-100 px-2.5 py-1.5 text-sm leading-relaxed text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
          {message.text}
        </div>
      </div>
    )
  }

  if (message.role === 'error') {
    return (
      <div className="border-l-2 border-red-300 pl-2 text-xs leading-relaxed text-red-600 dark:border-red-900/60 dark:text-red-400">
        {message.message}
      </div>
    )
  }

  return (
    <AssistantBlocks blocks={message.blocks} onToolCallEnd={onToolCallEnd} />
  )
}
