import './agent-markdown.css'

import type { ChatBubble, ReviewBatch } from '@haklex/rich-agent-core'
import { Streamdown } from '@lobehub/streamdown'
import { Check, CircleAlert, Lock, RotateCcw, X } from 'lucide-react'
import remarkGfm from 'remark-gfm'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import { type AgentTurnUsage, describeAgentUsage } from './agent-usage'
import { MessageAttachments } from './AttachmentChips'
import type { AssistantChatBubble, UserChatBubble } from './types'

const remarkPlugins = [remarkGfm]

interface AgentMessageItemProps {
  actionsLocked: boolean
  bubble: ChatBubble
  getBatch: (batchId: string) => ReviewBatch | undefined
  onAcceptBatch: (batchId: string) => void
  onRejectBatch: (batchId: string) => void
  onReapplyBatch: (batchId: string) => void
}

export function AgentMessageItem(props: AgentMessageItemProps) {
  const { t } = useI18n()
  const { bubble } = props

  switch (bubble.type) {
    case 'user': {
      const { attachments, selection } = bubble as UserChatBubble
      return (
        <div className="flex flex-col items-end gap-1.5">
          {attachments?.length ? (
            <MessageAttachments attachments={attachments} />
          ) : null}
          <div className="max-w-[84%] rounded-[12px_12px_4px_12px] bg-surface-inset px-3 dark:bg-surface-card py-2 text-base leading-[1.65] text-fg">
            {selection && (
              <div className="mb-1 truncate border-l-2 border-border-strong pl-2 text-sm text-fg-muted">
                {selection.type === 'text'
                  ? `"${selection.text}"`
                  : t('write.agent.selection.blocks', {
                      count: selection.blockIds.length,
                    })}
              </div>
            )}
            <div className="whitespace-pre-wrap break-words">
              {bubble.content}
            </div>
          </div>
        </div>
      )
    }

    case 'assistant': {
      const { usage } = bubble as AssistantChatBubble
      return (
        <div>
          <div className="agent-md">
            <Streamdown
              content={bubble.content}
              granularity="char"
              remarkPlugins={remarkPlugins}
            />
          </div>
          {usage ? <AgentUsageLine usage={usage} /> : null}
        </div>
      )
    }

    case 'tool_call': {
      return (
        <div className="text-sm text-fg-subtle">
          {t('write.agent.bubble.callingTool', { toolName: bubble.toolName })}
        </div>
      )
    }

    case 'tool_result': {
      return (
        <div className="flex items-center gap-1.5 text-sm text-fg-subtle">
          {bubble.success ? (
            <Check aria-hidden="true" className="size-3.5" />
          ) : (
            <X
              aria-hidden="true"
              className="size-3.5 text-red-600 dark:text-red-400"
            />
          )}
          {bubble.summary}
        </div>
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

      const total = batch.entries.length

      return (
        <div className="rounded-md border border-border-strong bg-surface-card p-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-fg">
              {t('write.agent.review.title')}
            </span>
            <span className="ml-auto text-sm tabular-nums text-fg-subtle">
              {t('write.agent.review.summary', { pending, accepted, rejected })}
            </span>
          </div>
          {total > 0 ? (
            <div aria-hidden="true" className="mt-2.5 flex h-1 gap-0.5">
              {batch.entries.map((entry, index) => (
                <span
                  className={cn(
                    'flex-1 rounded-full bg-border-strong',
                    entry.status === 'accepted' && 'bg-accent',
                    entry.status === 'rejected' && 'bg-fg/35',
                  )}
                  key={index}
                />
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex items-center gap-1.5">
            <Button
              className="h-7 gap-1 px-2.5 text-sm"
              disabled={pending === 0 || props.actionsLocked}
              onClick={() => props.onAcceptBatch(batch.id)}
              type="button"
            >
              <Check aria-hidden="true" className="size-3.5" />
              {t('write.agent.button.accept')}
            </Button>
            <Button
              className="h-7 px-2.5 text-sm"
              disabled={pending === 0 || props.actionsLocked}
              onClick={() => props.onRejectBatch(batch.id)}
              type="button"
              variant="secondary"
            >
              {t('write.agent.button.reject')}
            </Button>
            <Button
              className="ml-auto h-7 gap-1 px-2 text-sm"
              disabled={props.actionsLocked}
              onClick={() => props.onReapplyBatch(batch.id)}
              type="button"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" className="size-3" />
              {t('write.agent.button.reapply')}
            </Button>
          </div>
          {props.actionsLocked ? (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-fg-subtle">
              <Lock aria-hidden="true" className="size-3" />
              {t('write.agent.review.lockedHint')}
            </div>
          ) : null}
        </div>
      )
    }

    case 'diff_summary': {
      return (
        <div className="flex items-center gap-1.5 text-sm tabular-nums text-fg-subtle">
          <Check aria-hidden="true" className="size-3.5" />
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
        <div className="flex items-start gap-2 rounded-sm bg-red-50 px-2.5 py-2 text-sm leading-relaxed text-red-700 dark:bg-red-950/25 dark:text-red-400">
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0"
          />
          <span className="min-w-0 break-words">{bubble.message}</span>
        </div>
      )
    }

    default: {
      return null
    }
  }
}

function AgentUsageLine({ usage }: { usage: AgentTurnUsage }) {
  const { t } = useI18n()
  const view = describeAgentUsage(usage)
  const parts = [
    t('write.agent.usage.input', { value: view.input }),
    t('write.agent.usage.output', { value: view.output }),
    view.hitRate
      ? t('write.agent.usage.cacheHit', { value: view.hitRate })
      : null,
    view.cost,
  ].filter((part): part is string => Boolean(part))

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm tabular-nums text-fg-subtle"
      data-agent-usage=""
      title={t('write.agent.usage.detail', {
        cacheRead: usage.cacheRead.toLocaleString(),
        cacheWrite: usage.cacheWrite.toLocaleString(),
        calls: usage.calls,
        input: usage.input.toLocaleString(),
        output: usage.output.toLocaleString(),
      })}
    >
      {parts.map((part, index) => (
        <span key={part} className="flex items-center gap-x-1.5">
          {index > 0 ? <span aria-hidden="true">·</span> : null}
          {part}
        </span>
      ))}
    </div>
  )
}
