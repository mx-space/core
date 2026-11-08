import type { ToolCallGroupItem } from '@haklex/rich-agent-core'
import { Check, ChevronRight, Loader2, RotateCcw, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import {
  type ProcessBubble,
  summarizeProcess,
  thoughtPreview,
} from './agent-process'

type ThinkingBubble = Extract<ProcessBubble, { type: 'thinking' }>

interface ProcessTraceProps {
  bubbles: ProcessBubble[]
  live: boolean
  reapplyDisabled: boolean
  onReapply: (items: ToolCallGroupItem[]) => void
}

export function ProcessTrace(props: ProcessTraceProps) {
  const { t } = useI18n()
  const { bubbles } = props
  const summary = summarizeProcess(bubbles)
  const showLive = props.live || summary.active
  const [open, setOpen] = useState<boolean | null>(null)
  const expanded = showLive || (open ?? summary.failed > 0)

  const parts: ReactNode[] = [
    <span className="text-fg-muted" key="done">
      {t('write.agent.process.done')}
    </span>,
  ]
  if (summary.thoughts > 0)
    parts.push(
      <span key="thoughts">
        {t('write.agent.process.thoughts', { count: summary.thoughts })}
      </span>,
    )
  if (summary.tools > 0)
    parts.push(
      <span key="tools">
        {t('write.agent.process.tools', { count: summary.tools })}
      </span>,
    )
  if (summary.failed > 0)
    parts.push(
      <span className="text-red-600 dark:text-red-400" key="failed">
        {t('write.agent.process.failed', { count: summary.failed })}
      </span>,
    )

  return (
    <div className="min-w-0">
      {showLive ? null : (
        <div className="flex min-w-0 items-center gap-2">
          <button
            aria-expanded={expanded}
            className="group flex h-7 min-w-0 flex-1 items-center gap-2 text-left text-sm text-fg-subtle transition-colors hover:text-fg-muted"
            data-process-summary=""
            onClick={() => setOpen(!expanded)}
            type="button"
          >
            <span className="flex size-4 shrink-0 items-center justify-center">
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  'size-3.5 transition-transform',
                  expanded && 'rotate-90',
                )}
              />
            </span>
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              {parts.map((part, index) => (
                <span className="flex items-center gap-1.5" key={index}>
                  {index > 0 ? (
                    <span aria-hidden="true" className="opacity-60">
                      ·
                    </span>
                  ) : null}
                  {part}
                </span>
              ))}
            </span>
          </button>
          {summary.replayable.length > 0 ? (
            <button
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm px-2 text-sm text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg disabled:pointer-events-none disabled:opacity-50"
              disabled={props.reapplyDisabled}
              onClick={() =>
                props.onReapply(
                  bubbles.flatMap((bubble) =>
                    bubble.type === 'tool_call_group' ? bubble.items : [],
                  ),
                )
              }
              type="button"
            >
              <RotateCcw aria-hidden="true" className="size-3" />
              {t('write.agent.process.reapply', {
                count: summary.replayable.length,
              })}
            </button>
          ) : null}
        </div>
      )}

      {expanded ? (
        <ol className="relative m-0 min-w-0 list-none p-0 before:absolute before:bottom-3.5 before:left-[7.5px] before:top-3.5 before:w-px before:bg-border-strong">
          {bubbles.flatMap((bubble, index) =>
            bubble.type === 'thinking'
              ? [<ThoughtStep bubble={bubble} key={bubble.id ?? `t${index}`} />]
              : bubble.items.map((item) => (
                  <ToolStep item={item} key={item.id} />
                )),
          )}
        </ol>
      ) : null}
    </div>
  )
}

function StepIcon({ children }: { children: ReactNode }) {
  return (
    <span className="relative flex size-4 shrink-0 items-center justify-center bg-background text-fg-subtle">
      {children}
    </span>
  )
}

function StepChevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      aria-hidden="true"
      className={cn(
        'size-3.5 shrink-0 text-fg-subtle transition-transform group-hover:text-fg',
        open && 'rotate-90',
      )}
    />
  )
}

function ThoughtStep({ bubble }: { bubble: ThinkingBubble }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const streaming = Boolean(bubble.isStreaming)
  const text = bubble.rawText ?? bubble.content
  const preview = thoughtPreview(text)

  return (
    <li className="min-w-0" data-process-step="">
      <button
        className="group flex h-7 w-full min-w-0 items-center gap-2 text-left text-sm"
        disabled={!text}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <StepIcon>
          {streaming ? (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          ) : (
            <span className="size-[5px] rounded-full border border-fg-subtle" />
          )}
        </StepIcon>
        <span
          className={cn('shrink-0', streaming ? 'text-fg' : 'text-fg-muted')}
        >
          {streaming
            ? t('write.agent.process.thinking')
            : t('write.agent.process.thought')}
        </span>
        <span className="min-w-0 flex-1 truncate text-fg-subtle">
          {preview}
        </span>
        {text ? <StepChevron open={open} /> : null}
      </button>
      {open && text ? (
        <div className="mb-1.5 ml-6 max-h-64 overflow-auto whitespace-pre-wrap break-words border-l border-border-strong pl-2.5 text-sm leading-relaxed text-fg-muted">
          {text}
        </div>
      ) : null}
    </li>
  )
}

function ToolStep({ item }: { item: ToolCallGroupItem }) {
  const { t } = useI18n()
  const hasParams = Object.keys(item.params).length > 0
  const hasDetail = hasParams || Boolean(item.result || item.error)
  const [open, setOpen] = useState(item.status === 'error')
  const failed = item.status === 'error'

  return (
    <li className="min-w-0" data-process-step="">
      <button
        className={cn(
          'group flex h-7 w-full min-w-0 items-center gap-2 text-left text-sm',
          !hasDetail && 'cursor-default',
        )}
        disabled={!hasDetail}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <StepIcon>
          {item.status === 'pending' ? (
            <span className="size-[5px] rounded-full bg-fg-subtle opacity-50" />
          ) : null}
          {item.status === 'running' ? (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          ) : null}
          {item.status === 'completed' ? (
            <Check aria-hidden="true" className="size-3.5" />
          ) : null}
          {failed ? (
            <X
              aria-hidden="true"
              className="size-3.5 text-red-600 dark:text-red-400"
            />
          ) : null}
        </StepIcon>
        <span className="shrink-0 font-mono text-fg">{item.toolName}</span>
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            failed ? 'text-red-600 dark:text-red-400' : 'text-fg-subtle',
          )}
        >
          {item.description}
        </span>
        {hasDetail ? <StepChevron open={open} /> : null}
      </button>
      {open && hasDetail ? (
        <div className="mb-1.5 ml-6 flex min-w-0 flex-col gap-2">
          {hasParams ? (
            <DetailBlock
              label={t('write.agent.process.params')}
              text={JSON.stringify(item.params, null, 2)}
            />
          ) : null}
          {item.result ? (
            <DetailBlock
              label={t('write.agent.process.result')}
              text={item.result}
            />
          ) : null}
          {item.error ? (
            <DetailBlock
              label={t('write.agent.process.error')}
              text={item.error}
              tone="error"
            />
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function DetailBlock(props: { label: string; text: string; tone?: 'error' }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-sm text-fg-subtle">{props.label}</div>
      <pre
        className={cn(
          'm-0 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xs px-2.5 py-2 font-mono text-sm leading-relaxed',
          props.tone === 'error'
            ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400'
            : 'bg-surface-inset text-fg-muted',
        )}
      >
        {props.text}
      </pre>
    </div>
  )
}
