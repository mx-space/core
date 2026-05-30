import { Check, ChevronRight, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { cn } from '~/utils/cn'

import type { AssistantToolCallBlock } from './types'

interface ToolCallCardProps {
  block: AssistantToolCallBlock
}

function serializeArgs(value: Record<string, unknown> | undefined) {
  if (!value) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function ToolCallCard({ block }: ToolCallCardProps) {
  const [open, setOpen] = useState(false)
  const isStreaming = block.status === 'streaming'
  const args = isStreaming
    ? block.partialArgs
    : (block.finalArgs ?? block.partialArgs)
  const argsText = serializeArgs(args)
  const hasArgs = argsText.length > 0 && argsText !== '{}'

  return (
    <div className="min-w-0 rounded border border-neutral-200 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/40">
      <button
        className={cn(
          'flex w-full min-w-0 items-center gap-2 px-2 py-1.5 text-left text-xs text-neutral-500 transition-colors dark:text-neutral-400',
          hasArgs
            ? 'hover:text-neutral-700 dark:hover:text-neutral-200'
            : 'cursor-default',
        )}
        disabled={!hasArgs}
        onClick={() => hasArgs && setOpen((value) => !value)}
        type="button"
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          {isStreaming ? (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          ) : (
            <Check aria-hidden="true" className="size-3.5 text-green-600" />
          )}
        </span>
        <span className="truncate font-mono text-neutral-600 dark:text-neutral-300">
          {block.toolName || '…'}
        </span>
        <span className="flex-1" />
        {hasArgs ? (
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'size-3 shrink-0 text-neutral-400 transition-transform',
              open && 'rotate-90',
            )}
          />
        ) : null}
      </button>

      {open && hasArgs ? (
        <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-neutral-200 bg-white p-2 font-mono text-xs leading-relaxed text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
          {argsText}
        </pre>
      ) : null}
    </div>
  )
}
