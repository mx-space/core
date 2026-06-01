// @vitest-environment node

import type { AiAgentSseEvent } from '@mx-space/ai'
import { describe, expect, it } from 'vitest'

import type { AgentToolDefinition } from './turn-loop'
import { runAgentTurn } from './turn-loop'

async function* events(items: AiAgentSseEvent[]) {
  yield* items
}

const readTool: AgentToolDefinition = {
  kind: 'read',
  manifest: {
    name: 'searchPosts',
    description: 'Search posts',
    parameters: {},
  },
  read: async () => ({ content: 'Found 2 posts.' }),
}

describe('runAgentTurn', () => {
  it('injects the runtime system prompt into transport requests without persisting it', async () => {
    const requests: Array<
      Parameters<Parameters<typeof runAgentTurn>[0]['transport']>[0]
    > = []
    const result = await runAgentTurn({
      messages: [{ type: 'user', content: 'Find posts' }],
      systemPrompt: 'Use frontend tools and require dry-run before writes.',
      tools: [readTool],
      transport: (request) => {
        requests.push(request)
        return events([
          {
            type: 'text_delta',
            contentIndex: 0,
            delta: 'Ready.',
          },
          { type: 'done', message: {} },
        ])
      },
    })

    expect(requests[0]?.messages[0]).toEqual({
      role: 'system',
      content: 'Use frontend tools and require dry-run before writes.',
    })
    expect(requests[0]?.messages[1]).toEqual({
      role: 'user',
      content: 'Find posts',
    })
    expect(result.messages).not.toContainEqual({
      role: 'system',
      content: 'Use frontend tools and require dry-run before writes.',
    })
  })

  it('emits incremental assistant snapshots while text is streaming', async () => {
    const snapshots: unknown[][] = []
    const result = await runAgentTurn({
      messages: [{ type: 'user', content: 'Stream answer' }],
      onMessages: (messages) => snapshots.push(messages),
      tools: [readTool],
      transport: () =>
        events([
          {
            type: 'text_delta',
            contentIndex: 0,
            delta: 'Hel',
          },
          {
            type: 'text_delta',
            contentIndex: 0,
            delta: 'lo',
          },
          { type: 'done', message: {} },
        ]),
    })

    expect(snapshots).toHaveLength(2)
    expect(snapshots[0]?.at(-1)).toEqual({
      content: 'Hel',
      streaming: true,
      type: 'assistant',
    })
    expect(snapshots[1]?.at(-1)).toEqual({
      content: 'Hello',
      streaming: true,
      type: 'assistant',
    })
    expect(result.messages.at(-1)).toEqual({
      content: 'Hello',
      type: 'assistant',
    })
  })

  it('continues the model turn after a read tool result', async () => {
    const requests: unknown[] = []
    const result = await runAgentTurn({
      messages: [{ type: 'user', content: 'Find posts' }],
      tools: [readTool],
      transport: (request) => {
        requests.push(request)
        if (requests.length === 1) {
          return events([
            {
              type: 'toolcall_end',
              contentIndex: 0,
              toolCall: { id: 'tc1', name: 'searchPosts', arguments: {} },
            },
            { type: 'done', message: {} },
          ])
        }
        return events([
          {
            type: 'text_delta',
            contentIndex: 0,
            delta: 'The posts are ready.',
          },
          { type: 'done', message: {} },
        ])
      },
    })

    expect(result.status).toBe('completed')
    expect(requests).toHaveLength(2)
    expect(result.messages).toContainEqual({
      role: 'tool_result',
      toolCallId: 'tc1',
      toolName: 'searchPosts',
      content: 'Found 2 posts.',
      isError: false,
    })
    expect(result.messages).toContainEqual({
      type: 'assistant',
      content: 'The posts are ready.',
    })
  })

  it('pauses write tools at dry-run approval', async () => {
    const result = await runAgentTurn({
      messages: [{ type: 'user', content: 'Patch posts' }],
      tools: [
        {
          kind: 'draftPatch',
          manifest: {
            name: 'draftPostPatch',
            description: 'Draft post patch',
            parameters: {},
          },
          dryRun: async () => ({
            dryRunHash: 'hash-1',
            summary: '2 posts would change.',
          }),
        },
      ],
      transport: () =>
        events([
          {
            type: 'toolcall_end',
            contentIndex: 0,
            toolCall: { id: 'tc1', name: 'draftPostPatch', arguments: {} },
          },
          { type: 'done', message: {} },
        ]),
    })

    expect(result.status).toBe('paused_for_approval')
    expect(result.messages.at(-1)).toMatchObject({
      blockingReasons: [],
      dryRunHash: 'hash-1',
      summary: '2 posts would change.',
      toolCallId: 'tc1',
      toolName: 'draftPostPatch',
      type: 'dry-run-result',
    })
  })

  it('does not append a duplicate tool result for an existing toolCallId', async () => {
    const result = await runAgentTurn({
      messages: [
        { type: 'user', content: 'Find posts' },
        {
          role: 'tool_result',
          toolCallId: 'tc1',
          toolName: 'searchPosts',
          content: 'Already done.',
        },
      ],
      tools: [readTool],
      transport: () =>
        events([
          {
            type: 'toolcall_end',
            contentIndex: 0,
            toolCall: { id: 'tc1', name: 'searchPosts', arguments: {} },
          },
          { type: 'done', message: {} },
        ]),
    })

    expect(
      result.messages.filter((message) => message.role === 'tool_result'),
    ).toHaveLength(1)
  })

  it('stops when the maximum tool iteration count is reached', async () => {
    const result = await runAgentTurn({
      maxToolIterations: 1,
      messages: [{ type: 'user', content: 'Find posts' }],
      tools: [readTool],
      transport: () =>
        events([
          {
            type: 'toolcall_end',
            contentIndex: 0,
            toolCall: {
              id: crypto.randomUUID(),
              name: 'searchPosts',
              arguments: {},
            },
          },
          { type: 'done', message: {} },
        ]),
    })

    expect(result.status).toBe('iteration_limit')
    expect(result.messages.at(-1)).toMatchObject({
      type: 'execute-result',
      content: 'Tool iteration limit reached after 1 iterations.',
    })
  })
})
