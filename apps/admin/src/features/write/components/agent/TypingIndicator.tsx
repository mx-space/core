import type { AssistantBlock } from './types'

type IndicatorKind = 'thinking' | 'toolcall' | 'text' | null

function resolveLastOpenBlock(blocks: AssistantBlock[]): AssistantBlock | null {
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i]
    if (block.status === 'streaming') return block
  }
  return null
}

export interface TypingIndicatorProps {
  blocks: AssistantBlock[] | null
}

export function TypingIndicator({ blocks }: TypingIndicatorProps) {
  const open = blocks ? resolveLastOpenBlock(blocks) : null
  const kind: IndicatorKind = open ? open.kind : null

  let label = 'Working…'
  if (kind === 'thinking') label = 'Thinking…'
  else if (kind === 'toolcall')
    label = `Calling ${(open as { toolName: string }).toolName || 'tool'}…`
  else if (kind === 'text') label = ''

  return (
    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
      <span className="flex items-center gap-0.5">
        <span className="size-1 animate-pulse rounded-full bg-neutral-400 [animation-delay:0ms]" />
        <span className="size-1 animate-pulse rounded-full bg-neutral-400 [animation-delay:150ms]" />
        <span className="size-1 animate-pulse rounded-full bg-neutral-400 [animation-delay:300ms]" />
      </span>
      {label ? <span>{label}</span> : null}
    </div>
  )
}
