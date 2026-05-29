import { Check, ChevronRight, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import type { ToolCallGroupItem } from '@haklex/rich-agent-core'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import { isReplayableToolItem } from './agent-operations'

type ItemStatus = ToolCallGroupItem['status']

function StatusIcon({ status }: { status: ItemStatus }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center">
      {status === 'pending' ? (
        <span className="size-1.5 rounded-full bg-neutral-300 opacity-50" />
      ) : null}
      {status === 'running' ? (
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
      ) : null}
      {status === 'completed' ? (
        <Check aria-hidden="true" className="size-3.5 text-green-600" />
      ) : null}
      {status === 'error' ? (
        <X aria-hidden="true" className="size-3.5 text-red-500" />
      ) : null}
    </span>
  )
}

function DetailBlock(props: { label: string; text: string; tone?: 'error' }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 font-mono text-xs uppercase tracking-wide text-neutral-400">
        {props.label}
      </div>
      <pre
        className={cn(
          'm-0 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded p-1.5 font-mono text-xs',
          props.tone === 'error'
            ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400'
            : 'bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400',
        )}
      >
        {props.text}
      </pre>
    </div>
  )
}

function ToolItemRow({ item }: { item: ToolCallGroupItem }) {
  const [open, setOpen] = useState(false)
  const hasDetail =
    Object.keys(item.params).length > 0 || Boolean(item.result || item.error)

  return (
    <div className="min-w-0">
      <button
        className={cn(
          'flex w-full min-w-0 items-center gap-2 py-1 text-left text-xs leading-snug text-neutral-400 transition-colors',
          hasDetail
            ? 'hover:text-neutral-700 dark:hover:text-neutral-200'
            : 'cursor-default',
        )}
        disabled={!hasDetail}
        onClick={() => hasDetail && setOpen((value) => !value)}
        type="button"
      >
        <StatusIcon status={item.status} />
        <span className="truncate font-mono text-neutral-500 dark:text-neutral-300">
          {item.toolName}
        </span>
        {item.description ? (
          <span className="min-w-0 flex-1 truncate text-neutral-400">
            {item.description}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {hasDetail ? (
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'size-3 shrink-0 text-neutral-400 transition-transform',
              open && 'rotate-90',
            )}
          />
        ) : null}
      </button>

      {open && hasDetail ? (
        <div className="flex min-w-0 flex-col gap-2 pb-2 pl-6">
          {Object.keys(item.params).length > 0 ? (
            <DetailBlock
              label="params"
              text={JSON.stringify(item.params, null, 2)}
            />
          ) : null}
          {item.result ? (
            <DetailBlock label="result" text={item.result} />
          ) : null}
          {item.error ? (
            <DetailBlock label="error" text={item.error} tone="error" />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function deriveGroupStatus(items: ToolCallGroupItem[]): ItemStatus {
  if (items.some((item) => item.status === 'error')) return 'error'
  if (items.some((item) => item.status === 'running')) return 'running'
  if (items.length > 0 && items.every((item) => item.status === 'completed'))
    return 'completed'
  return 'pending'
}

export function ToolCallGroupView(props: {
  items: ToolCallGroupItem[]
  reapplyDisabled?: boolean
  onReapply: (items: ToolCallGroupItem[]) => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const { items } = props
  const replayable = items.filter(isReplayableToolItem)
  const completed = items.filter((item) => item.status === 'completed').length
  const status = deriveGroupStatus(items)

  return (
    <div className="min-w-0">
      <button
        className="flex w-full min-w-0 items-center gap-2 py-1 text-left text-xs leading-snug text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <StatusIcon status={status} />
        <span className="min-w-0 flex-1 truncate">
          {t('write.agent.bubble.toolGroupCount', { count: items.length })}
        </span>
        <span className="shrink-0 font-mono text-neutral-400">
          {completed}/{items.length}
        </span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'size-3 shrink-0 text-neutral-400 transition-transform',
            open && 'rotate-90',
          )}
        />
      </button>

      {open ? (
        <div className="min-w-0 pl-4">
          {items.map((item) => (
            <ToolItemRow item={item} key={item.id} />
          ))}
        </div>
      ) : null}

      {replayable.length > 0 ? (
        <Button
          className="mt-1.5 h-6 px-2 text-xs"
          disabled={props.reapplyDisabled}
          onClick={() => props.onReapply(items)}
          type="button"
          variant="subtle"
        >
          {t('write.agent.button.reapply')}
          {t('write.agent.bubble.toolGroupReapply', {
            count: replayable.length,
          })}
        </Button>
      ) : null}
    </div>
  )
}
