import type { ChatBubble, ToolCallGroupItem } from '@haklex/rich-agent-core'

import { isReplayableToolItem } from './agent-operations'

export type ProcessBubble = Extract<
  ChatBubble,
  { type: 'thinking' } | { type: 'tool_call_group' }
>

export type BubbleSegment<T extends { bubble: ChatBubble }> =
  | { kind: 'process'; entries: (T & { bubble: ProcessBubble })[] }
  | { kind: 'single'; entry: T }

export interface ProcessSummary {
  active: boolean
  failed: number
  replayable: ToolCallGroupItem[]
  thoughts: number
  tools: number
}

export function isProcessBubble(bubble: ChatBubble): bubble is ProcessBubble {
  return bubble.type === 'thinking' || bubble.type === 'tool_call_group'
}

export function segmentBubbles<T extends { bubble: ChatBubble }>(
  entries: T[],
): BubbleSegment<T>[] {
  const segments: BubbleSegment<T>[] = []
  for (const entry of entries) {
    const last = segments.at(-1)
    if (!isProcessBubble(entry.bubble)) {
      segments.push({ entry, kind: 'single' })
      continue
    }
    const processEntry = entry as T & { bubble: ProcessBubble }
    if (last?.kind === 'process') last.entries.push(processEntry)
    else segments.push({ entries: [processEntry], kind: 'process' })
  }
  return segments
}

export function summarizeProcess(bubbles: ProcessBubble[]): ProcessSummary {
  const summary: ProcessSummary = {
    active: false,
    failed: 0,
    replayable: [],
    thoughts: 0,
    tools: 0,
  }
  for (const bubble of bubbles) {
    if (bubble.type === 'thinking') {
      summary.thoughts++
      if (bubble.isStreaming) summary.active = true
      continue
    }
    for (const item of bubble.items) {
      summary.tools++
      if (item.status === 'error') summary.failed++
      if (item.status === 'running' || item.status === 'pending')
        summary.active = true
      if (isReplayableToolItem(item)) summary.replayable.push(item)
    }
  }
  return summary
}

export function thoughtPreview(text: string) {
  const line = text
    .split('\n')
    .map((value) => value.trim())
    .find(Boolean)
  return line ? line.replaceAll(/[*_`#>]+/g, '').trim() : ''
}
