import type { ChatBubble, ToolCallGroupItem } from '@haklex/rich-agent-core'
import { Check, X } from 'lucide-react'

import { useI18n } from '~/i18n'
import { MarkdownRender } from '~/ui/primitives/markdown-render'

import { ToolCallGroupView } from './ToolCallView'

interface AgentMessageItemProps {
  actionsLocked: boolean
  bubble: ChatBubble
  onReapplyToolGroup: (items: ToolCallGroupItem[]) => void
}

export function AgentMessageItem(props: AgentMessageItemProps) {
  const { t } = useI18n()
  const { bubble } = props

  switch (bubble.type) {
    case 'user': {
      return (
        <div className="flex justify-end">
          <div className="max-w-[82%] whitespace-pre-wrap break-words bg-neutral-100 px-2.5 py-1.5 text-sm leading-relaxed text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
            {bubble.content}
          </div>
        </div>
      )
    }

    case 'assistant': {
      return (
        <MarkdownRender
          className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200"
          text={bubble.content}
        />
      )
    }

    case 'thinking': {
      return (
        <div className="text-xs italic leading-relaxed text-neutral-400">
          {bubble.content || t('write.agent.bubble.thinking')}
        </div>
      )
    }

    case 'tool_call': {
      return (
        <div className="text-xs text-neutral-400">
          {t('write.agent.bubble.callingTool', { toolName: bubble.toolName })}
        </div>
      )
    }

    case 'tool_result': {
      return (
        <div className="flex items-center gap-1 text-xs text-neutral-400">
          {bubble.success ? (
            <Check aria-hidden="true" className="size-3 text-green-600" />
          ) : (
            <X aria-hidden="true" className="size-3 text-red-500" />
          )}
          {bubble.summary}
        </div>
      )
    }

    case 'tool_call_group': {
      return (
        <ToolCallGroupView
          items={bubble.items}
          onReapply={props.onReapplyToolGroup}
          reapplyDisabled={props.actionsLocked}
        />
      )
    }

    case 'error': {
      return (
        <div className="border-l-2 border-red-300 pl-2 text-xs leading-relaxed text-red-600 dark:border-red-900/60 dark:text-red-400">
          {bubble.message}
        </div>
      )
    }

    default: {
      return null
    }
  }
}
