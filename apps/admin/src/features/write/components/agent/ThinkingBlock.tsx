import { ChevronRight, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { cn } from '~/utils/cn'

import type { AssistantThinkingBlock } from './types'

interface ThinkingBlockProps {
  block: AssistantThinkingBlock
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 10) return `${seconds.toFixed(1)}s`
  return `${Math.round(seconds)}s`
}

export function ThinkingBlock({ block }: ThinkingBlockProps) {
  const [open, setOpen] = useState(false)
  const isStreaming = block.status === 'streaming'
  const duration =
    block.endedAt !== undefined ? block.endedAt - block.startedAt : null
  const label = isStreaming
    ? 'Thinking…'
    : duration !== null
      ? `Thought for ${formatDuration(duration)}`
      : 'Thought'

  return (
    <div className="min-w-0">
      <button
        className="flex w-full min-w-0 items-center gap-1.5 py-0.5 text-left text-xs text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {isStreaming ? (
          <Loader2 aria-hidden="true" className="size-3 animate-spin" />
        ) : (
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'size-3 shrink-0 transition-transform',
              open && 'rotate-90',
            )}
          />
        )}
        <span className="italic">{label}</span>
      </button>

      {open && block.text ? (
        <pre className="m-0 mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-neutral-50 p-2 font-mono text-xs leading-relaxed text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
          {block.text}
        </pre>
      ) : null}
    </div>
  )
}
