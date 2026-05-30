import type { AiAgentSseEvent } from '@mx-space/api-client'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '~/i18n'

import { MessageList } from '../MessageList'
import type {
  AgentStreamStatus,
  AssistantBlock,
  AssistantChatMessage,
  AssistantTextBlock,
  AssistantThinkingBlock,
  AssistantToolCallBlock,
  ChatMessageEntry,
} from '../types'

interface Harness {
  container: HTMLDivElement
  root: Root
  unmount: () => void
}

function mount(): Harness {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

async function renderMessageList(
  harness: Harness,
  messages: ChatMessageEntry[],
  streamStatus: AgentStreamStatus = 'idle',
) {
  await act(async () => {
    harness.root.render(
      createElement(
        I18nProvider,
        null,
        createElement(MessageList, {
          isHydrating: false,
          messages,
          streamStatus,
        }),
      ),
    )
  })

  // MarkdownRender renders text via an async marked.parse() in useEffect.
  // Flush microtasks so the parsed HTML is committed to the DOM before
  // tests probe it.
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve()
  })
}

function applyEvents(events: AiAgentSseEvent[]): AssistantChatMessage {
  const blocks = new Map<number, AssistantBlock>()
  for (const event of events) {
    switch (event.type) {
      case 'text_start': {
        if (!blocks.has(event.contentIndex)) {
          blocks.set(event.contentIndex, {
            contentIndex: event.contentIndex,
            kind: 'text',
            status: 'streaming',
            text: '',
          })
        }
        break
      }
      case 'text_delta': {
        const prev = blocks.get(event.contentIndex)
        const base: AssistantTextBlock =
          prev && prev.kind === 'text'
            ? prev
            : {
                contentIndex: event.contentIndex,
                kind: 'text',
                status: 'streaming',
                text: '',
              }
        blocks.set(event.contentIndex, {
          ...base,
          text: base.text + event.delta,
        })
        break
      }
      case 'text_end': {
        const prev = blocks.get(event.contentIndex)
        if (prev && prev.kind === 'text') {
          blocks.set(event.contentIndex, { ...prev, status: 'done' })
        }
        break
      }
      case 'thinking_start': {
        if (!blocks.has(event.contentIndex)) {
          blocks.set(event.contentIndex, {
            contentIndex: event.contentIndex,
            kind: 'thinking',
            startedAt: 0,
            status: 'streaming',
            text: '',
          })
        }
        break
      }
      case 'thinking_delta': {
        const prev = blocks.get(event.contentIndex)
        const base: AssistantThinkingBlock =
          prev && prev.kind === 'thinking'
            ? prev
            : {
                contentIndex: event.contentIndex,
                kind: 'thinking',
                startedAt: 0,
                status: 'streaming',
                text: '',
              }
        blocks.set(event.contentIndex, {
          ...base,
          text: base.text + event.delta,
        })
        break
      }
      case 'thinking_end': {
        const prev = blocks.get(event.contentIndex)
        if (prev && prev.kind === 'thinking') {
          blocks.set(event.contentIndex, {
            ...prev,
            endedAt: 1,
            status: 'done',
          })
        }
        break
      }
      case 'toolcall_start': {
        if (!blocks.has(event.contentIndex)) {
          blocks.set(event.contentIndex, {
            contentIndex: event.contentIndex,
            kind: 'toolcall',
            partialArgs: {},
            status: 'streaming',
            toolName: event.name ?? '',
          })
        }
        break
      }
      case 'toolcall_delta': {
        const prev = blocks.get(event.contentIndex)
        const base: AssistantToolCallBlock =
          prev && prev.kind === 'toolcall'
            ? prev
            : {
                contentIndex: event.contentIndex,
                kind: 'toolcall',
                partialArgs: {},
                status: 'streaming',
                toolName: '',
              }
        blocks.set(event.contentIndex, {
          ...base,
          partialArgs: { ...base.partialArgs, ...event.partialArgs },
        })
        break
      }
      case 'toolcall_end': {
        const prev = blocks.get(event.contentIndex)
        const base: AssistantToolCallBlock =
          prev && prev.kind === 'toolcall'
            ? prev
            : {
                contentIndex: event.contentIndex,
                kind: 'toolcall',
                partialArgs: {},
                status: 'streaming',
                toolName: event.toolCall.name,
              }
        blocks.set(event.contentIndex, {
          ...base,
          finalArgs: event.toolCall.arguments,
          status: 'done',
          toolCallId: event.toolCall.id,
          toolName: event.toolCall.name,
        })
        break
      }
    }
  }

  return {
    blocks: [...blocks.values()],
    id: 'asst-1',
    role: 'assistant',
  }
}

// Build a 50-frame canned stream with interleaved text / thinking / toolcall
// deltas. We allocate three contentIndex lanes (0=text, 1=thinking, 2=toolcall)
// and assert that the rendered DOM block ordering matches the contentIndex
// ordering of those lanes — text first, then thinking, then toolcall.
function buildInterleavedStream(): AiAgentSseEvent[] {
  const TEXT_IDX = 0
  const THINK_IDX = 1
  const TOOL_IDX = 2
  const events: AiAgentSseEvent[] = [
    { contentIndex: TEXT_IDX, type: 'text_start' },
    { contentIndex: THINK_IDX, type: 'thinking_start' },
    { contentIndex: TOOL_IDX, name: 'insert_node', type: 'toolcall_start' },
  ]

  // Round-robin interleave: 47 delta frames spread across the three lanes.
  // text gets every 1st of 3, thinking every 2nd, toolcall every 3rd.
  for (let i = 0; i < 47; i += 1) {
    const lane = i % 3
    if (lane === 0) {
      events.push({
        contentIndex: TEXT_IDX,
        delta: `t${i} `,
        type: 'text_delta',
      })
    } else if (lane === 1) {
      events.push({
        contentIndex: THINK_IDX,
        delta: `k${i} `,
        type: 'thinking_delta',
      })
    } else {
      events.push({
        contentIndex: TOOL_IDX,
        partialArgs: { [`p${i}`]: i },
        type: 'toolcall_delta',
      })
    }
  }

  // 3 start frames + 47 delta frames = 50 frames total before completion.
  return events
}

let harness: Harness

beforeEach(() => {
  harness = mount()
})

afterEach(() => {
  harness.unmount()
  document.body.innerHTML = ''
})

describe('agent transport integration', () => {
  it('renders interleaved text/thinking/toolcall blocks in contentIndex order from a 50-frame stream', async () => {
    const events = buildInterleavedStream()
    expect(events).toHaveLength(50)

    const assistant = applyEvents(events)
    await renderMessageList(harness, [assistant], 'streaming')

    // The three blocks should appear in contentIndex order: text(0), thinking(1), toolcall(2).
    // Probe for one stable identifying token per block kind:
    //   text     -> markdown viewport text starts with 't0 '
    //   thinking -> label 'Thinking…' (italic span)
    //   toolcall -> font-mono tool-name span 'insert_node'
    const containerHtml = harness.container.innerHTML

    const textIdx = containerHtml.indexOf('t0 ')
    const thinkingIdx = containerHtml.indexOf('Thinking')
    const toolcallIdx = containerHtml.indexOf('insert_node')

    expect(textIdx).toBeGreaterThanOrEqual(0)
    expect(thinkingIdx).toBeGreaterThan(textIdx)
    expect(toolcallIdx).toBeGreaterThan(thinkingIdx)

    // The text block accumulated all 16 lane-0 deltas. The last delta we emit
    // for that lane is at iteration 45 (i=45, lane=0), so 't45 ' must appear
    // in the DOM — proves accumulation, not just first-frame rendering.
    expect(containerHtml).toContain('t45')
  })

  it('renders a visible "connection lost" affordance without crashing when the stream drops mid-flight', async () => {
    // Take the first 25 frames of the stream — simulating an abrupt
    // disconnect partway through — then mark the stream state as lost.
    const partial = buildInterleavedStream().slice(0, 25)
    const assistant = applyEvents(partial)

    let threw: unknown = null
    try {
      await renderMessageList(harness, [assistant], 'connection_lost')
    } catch (error) {
      threw = error
    }
    expect(threw).toBeNull()

    expect(harness.container.textContent ?? '').toContain('connection lost')
  })
})
