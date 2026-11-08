import type { ChatBubble, ToolCallGroupItem } from '@haklex/rich-agent-core'
import { describe, expect, it } from 'vitest'

import {
  segmentBubbles,
  summarizeProcess,
  thoughtPreview,
} from './agent-process'

const thinking = (content: string, isStreaming = false): ChatBubble => ({
  content,
  isStreaming,
  type: 'thinking',
})

const tool = (
  status: ToolCallGroupItem['status'],
  result?: string,
): ToolCallGroupItem =>
  ({
    id: crypto.randomUUID(),
    params: {},
    result,
    status,
    toolName: 'edit',
  }) as ToolCallGroupItem

const group = (...items: ToolCallGroupItem[]): ChatBubble => ({
  id: crypto.randomUUID(),
  items,
  type: 'tool_call_group',
})

const entries = (bubbles: ChatBubble[]) =>
  bubbles.map((bubble, index) => ({ bubble, index }))

describe('segmentBubbles', () => {
  it('merges consecutive thinking and tool groups into one process segment', () => {
    const segments = segmentBubbles(
      entries([
        { content: 'go', type: 'user' },
        thinking('a'),
        group(tool('completed')),
        thinking('b'),
        group(tool('completed'), tool('completed')),
        { content: 'done', streaming: false, type: 'assistant' },
      ]),
    )

    expect(segments.map((segment) => segment.kind)).toEqual([
      'single',
      'process',
      'single',
    ])
    const process = segments[1]
    expect(process.kind === 'process' && process.entries).toHaveLength(4)
  })

  it('starts a new process segment after an assistant reply', () => {
    const segments = segmentBubbles(
      entries([
        thinking('a'),
        { content: 'part', streaming: false, type: 'assistant' },
        group(tool('completed')),
      ]),
    )

    expect(segments.map((segment) => segment.kind)).toEqual([
      'process',
      'single',
      'process',
    ])
  })
})

describe('summarizeProcess', () => {
  it('counts thoughts, tool calls and failures', () => {
    const summary = summarizeProcess([
      thinking('a'),
      group(tool('completed'), tool('error')),
      thinking('b'),
      group(tool('completed')),
    ] as Parameters<typeof summarizeProcess>[0])

    expect(summary).toMatchObject({
      active: false,
      failed: 1,
      thoughts: 2,
      tools: 3,
    })
  })

  it('is active while a thought streams or a tool runs', () => {
    expect(
      summarizeProcess([thinking('a', true)] as Parameters<
        typeof summarizeProcess
      >[0]).active,
    ).toBe(true)
    expect(
      summarizeProcess([group(tool('running'))] as Parameters<
        typeof summarizeProcess
      >[0]).active,
    ).toBe(true)
  })

  it('collects replayable tool items across groups', () => {
    const op = JSON.stringify({ op: { blockId: 'b1', op: 'delete' } })
    const summary = summarizeProcess([
      group(tool('completed', op), tool('completed', 'plain')),
      group(tool('completed', op)),
    ] as Parameters<typeof summarizeProcess>[0])

    expect(summary.replayable).toHaveLength(2)
  })
})

describe('thoughtPreview', () => {
  it('returns the first non-empty line without markdown emphasis', () => {
    expect(thoughtPreview('\n\n**Plan** read each embed\nthen edit')).toBe(
      'Plan read each embed',
    )
  })

  it('returns an empty string for blank text', () => {
    expect(thoughtPreview('  \n ')).toBe('')
  })
})
