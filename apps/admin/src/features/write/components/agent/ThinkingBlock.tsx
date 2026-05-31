import type { ChatBubble } from '@haklex/rich-agent-core'
import { ChevronRight, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { cn } from '~/utils/cn'

type ThinkingBubble = Extract<ChatBubble, { type: 'thinking' }>

interface ThinkingBlockProps {
  bubble: ThinkingBubble
}

export function ThinkingBlock({ bubble }: ThinkingBlockProps) {
  const [open, setOpen] = useState(false)
  const isStreaming = Boolean(bubble.isStreaming)
  const label = isStreaming ? 'Thinking…' : 'Thought'
  const text = bubble.rawText ?? bubble.content

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

      {open && text ? (
        <pre className="m-0 mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-surface-inset p-2 font-mono text-xs leading-relaxed text-fg-muted">
          {text}
        </pre>
      ) : null}
    </div>
  )
}
