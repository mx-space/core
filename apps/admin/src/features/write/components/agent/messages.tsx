import { Check, X } from 'lucide-react'
import type {
  ChatBubble,
  ReviewBatch,
  ToolCallGroupItem,
} from '@haklex/rich-agent-core'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { MarkdownRender } from '~/ui/primitives/markdown-render'

import { ToolCallGroupView } from './ToolCallView'

interface AgentMessageItemProps {
  actionsLocked: boolean
  bubble: ChatBubble
  getBatch: (batchId: string) => ReviewBatch | undefined
  onAcceptBatch: (batchId: string) => void
  onRejectBatch: (batchId: string) => void
  onReapplyBatch: (batchId: string) => void
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

    case 'diff_review': {
      const batch = props.getBatch(bubble.batchId)
      if (!batch) return null

      const pending = batch.entries.filter(
        (entry) => entry.status === 'pending',
      ).length
      const accepted = batch.entries.filter(
        (entry) => entry.status === 'accepted',
      ).length
      const rejected = batch.entries.filter(
        (entry) => entry.status === 'rejected',
      ).length

      return (
        <div className="border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100">
            {t('write.agent.review.title')}
          </div>
          <div className="text-xs text-neutral-500">
            {t('write.agent.review.summary', { pending, accepted, rejected })}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button
              className="h-7 px-2 text-xs"
              disabled={pending === 0 || props.actionsLocked}
              onClick={() => props.onAcceptBatch(batch.id)}
              type="button"
            >
              {t('write.agent.button.accept')}
            </Button>
            <Button
              className="h-7 px-2 text-xs"
              disabled={pending === 0 || props.actionsLocked}
              onClick={() => props.onRejectBatch(batch.id)}
              type="button"
              variant="subtle"
            >
              {t('write.agent.button.reject')}
            </Button>
            <Button
              className="h-7 px-2 text-xs"
              disabled={props.actionsLocked}
              onClick={() => props.onReapplyBatch(batch.id)}
              type="button"
              variant="subtle"
            >
              {t('write.agent.button.reapply')}
            </Button>
          </div>
          {props.actionsLocked ? (
            <div className="mt-1.5 text-xs text-neutral-400">
              {t('write.agent.review.lockedHint')}
            </div>
          ) : null}
        </div>
      )
    }

    case 'diff_summary': {
      return (
        <div className="text-xs text-neutral-400">
          {t('write.agent.bubble.diffSummary', {
            accepted: bubble.accepted,
            rejected: bubble.rejected,
            pending: bubble.pending,
          })}
        </div>
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
