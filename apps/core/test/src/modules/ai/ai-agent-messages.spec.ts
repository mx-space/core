import { describe, expect, it } from 'vitest'

import { AIProviderType } from '~/modules/ai/ai.types'
import {
  bubblesToHistory,
  toPiMessages,
} from '~/modules/ai/ai-agent/ai-agent-messages'

describe('toPiMessages', () => {
  it.each([
    [AIProviderType.OpenAICompatible, 'openai-completions'],
    [AIProviderType.Anthropic, 'anthropic-messages'],
  ] as const)(
    'replays assistant history using the selected %s protocol',
    (type, api) => {
      const { piMessages } = toPiMessages(
        [
          { role: 'assistant', content: 'previous answer' },
          {
            role: 'assistant_tool_call',
            toolCalls: [
              { id: 'call-1', name: 'lookup', arguments: '{"id":1}' },
            ],
          },
        ],
        { api, id: 'selected-provider', type, model: 'selected-model' },
      )

      expect(piMessages).toEqual([
        expect.objectContaining({
          api,
          provider: 'selected-provider',
          model: 'selected-model',
        }),
        expect.objectContaining({
          api,
          provider: 'selected-provider',
          model: 'selected-model',
        }),
      ])
    },
  )
})

describe('bubblesToHistory', () => {
  it('keeps finished user and assistant text and drops everything else', () => {
    expect(
      bubblesToHistory([
        { type: 'user', content: 'q' },
        { type: 'tool_call_group', id: 'g', items: [] },
        { type: 'assistant', content: 'partial', streaming: true },
        { type: 'assistant', content: 'a' },
        { type: '__agent_review_state__', reviewState: {} },
      ]),
    ).toEqual([
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ])
  })
})
