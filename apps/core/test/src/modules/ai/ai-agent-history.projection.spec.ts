import type { Message as PiMessage } from '@earendil-works/pi-ai'
import { describe, expect, it } from 'vitest'

import { projectTranscriptToBubbles } from '~/modules/ai/ai-agent/ai-agent-history.projection'

const usage = (input: number, output: number, total: number) => ({
  input,
  output,
  cacheRead: 1,
  cacheWrite: 0,
  totalTokens: input + output,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total },
})

const user = (content: string): PiMessage => ({
  role: 'user',
  content,
  timestamp: 1,
})

const assistant = (content: any[], callUsage = usage(10, 5, 0.01)): PiMessage =>
  ({
    role: 'assistant',
    content,
    api: 'openai-completions',
    provider: 'p',
    model: 'm',
    usage: callUsage,
    stopReason: content.some((block) => block.type === 'toolCall')
      ? 'toolUse'
      : 'stop',
    timestamp: 2,
  }) as PiMessage

const toolResult = (
  toolCallId: string,
  toolName: string,
  text: string,
  isError = false,
): PiMessage => ({
  role: 'toolResult',
  toolCallId,
  toolName,
  content: [{ type: 'text', text }],
  isError,
  timestamp: 3,
})

const call = (
  id: string,
  name: string,
  args: Record<string, unknown> = {},
) => ({
  type: 'toolCall',
  id,
  name,
  arguments: args,
})

describe('projectTranscriptToBubbles', () => {
  it('strips the system reminder from user messages', () => {
    expect(
      projectTranscriptToBubbles(
        [
          user(
            '<system-reminder>\n/doc.xml changed since you last saw it\n</system-reminder>\n\nTighten the intro',
          ),
        ],
        [],
      ),
    ).toEqual([{ type: 'user', content: 'Tighten the intro' }])
  })

  it('turns thinking into a thinking bubble split into steps', () => {
    const [bubble] = projectTranscriptToBubbles(
      [
        assistant([
          { type: 'thinking', thinking: 'First idea.\n\nSecond idea.' },
        ]),
      ],
      [],
    )
    expect(bubble).toMatchObject({
      type: 'thinking',
      content: 'First idea.\n\nSecond idea.',
      rawText: 'First idea.\n\nSecond idea.',
      steps: ['First idea.', 'Second idea.'],
    })
  })

  it('sums usage over a turn onto its last assistant bubble', () => {
    const bubbles = projectTranscriptToBubbles(
      [
        user('go'),
        assistant(
          [{ type: 'text', text: 'Looking.' }, call('c1', 'bash')],
          usage(10, 5, 0.01),
        ),
        toolResult('c1', 'bash', 'ok'),
        assistant([{ type: 'text', text: 'Done.' }], usage(20, 7, 0.02)),
        user('again'),
        assistant([{ type: 'text', text: 'Sure.' }], usage(1, 1, 0)),
      ],
      [],
    )
    const assistants = bubbles.filter((bubble) => bubble.type === 'assistant')
    expect(assistants[0]).toEqual({ type: 'assistant', content: 'Looking.' })
    expect(assistants[1]).toEqual({
      type: 'assistant',
      content: 'Done.',
      usage: {
        calls: 2,
        input: 30,
        output: 12,
        cacheRead: 2,
        cacheWrite: 0,
        cost: 0.03,
      },
    })
    expect(assistants[2]).toMatchObject({
      content: 'Sure.',
      usage: { calls: 1 },
    })
  })

  it('groups the tool calls of one model call with their results', () => {
    const bubbles = projectTranscriptToBubbles(
      [
        assistant([
          call('c1', 'bash', { command: 'cat /doc.xml' }),
          call('c2', 'search_articles', { keyword: 'rust' }),
          call('c3', 'bash', { command: 'rm -rf /' }),
        ]),
        toolResult('c1', 'bash', '<doc/>'),
        toolResult('c2', 'search_articles', 'Tool failed: boom', true),
      ],
      [],
    )
    expect(bubbles).toEqual([
      {
        type: 'tool_call_group',
        id: 'tcg-0',
        items: [
          {
            id: 'c1',
            toolName: 'bash',
            params: { command: 'cat /doc.xml' },
            status: 'completed',
            result: '<doc/>',
            resultPreview: '<doc/>',
          },
          {
            id: 'c2',
            toolName: 'search_articles',
            params: { keyword: 'rust' },
            status: 'error',
            error: 'Tool failed: boom',
          },
          {
            id: 'c3',
            toolName: 'bash',
            params: { command: 'rm -rf /' },
            status: 'error',
            error: 'Tool did not complete',
          },
        ],
      },
    ])
  })

  it('truncates large results but keeps operations and full-result tools whole', () => {
    const big = 'x'.repeat(5000)
    const operation = JSON.stringify({
      op: { op: 'replace', blockId: 'b1', xml: 'y'.repeat(5000) },
    })
    const dynamic = JSON.stringify({ source: 'z'.repeat(5000) })
    const [group] = projectTranscriptToBubbles(
      [
        assistant([
          call('c1', 'bash'),
          call('c2', 'edit_block'),
          call('c3', 'preview_dynamic_component'),
        ]),
        toolResult('c1', 'bash', big),
        toolResult('c2', 'edit_block', operation),
        toolResult('c3', 'preview_dynamic_component', dynamic),
      ],
      [],
    )
    if (group.type !== 'tool_call_group') throw new Error('expected a group')
    expect(group.items[0]).toEqual({
      id: 'c1',
      toolName: 'bash',
      params: {},
      status: 'completed',
      resultPreview: big.slice(0, 80),
      truncated: true,
    })
    expect(group.items[1].result).toBe(operation)
    expect(group.items[2].result).toBe(dynamic)
  })

  it('places a review batch after the group that produced it', () => {
    const bubbles = projectTranscriptToBubbles(
      [
        user('edit'),
        assistant([call('c1', 'bash')]),
        toolResult('c1', 'bash', ''),
        assistant([{ type: 'text', text: 'Proposed.' }]),
      ],
      [
        { batchId: 'batch-1', toolCallId: 'c1' },
        { batchId: 'b_rphan', toolCallId: 'gone' },
      ],
    )
    expect(bubbles.map((bubble) => bubble.type)).toEqual([
      'user',
      'tool_call_group',
      'diff_review',
      'assistant',
      'diff_review',
    ])
    expect(bubbles[2]).toEqual({ type: 'diff_review', batchId: 'batch-1' })
    expect(bubbles[4]).toEqual({ type: 'diff_review', batchId: 'b_rphan' })
  })
})
