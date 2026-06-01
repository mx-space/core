// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildTitleProjection,
  compileAgentMessages,
} from './message-normalizer'

describe('compileAgentMessages', () => {
  it('compiles role-bearing wire messages unchanged enough for chat transport', () => {
    expect(
      compileAgentMessages([
        { role: 'system', content: 'core' },
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ]),
    ).toEqual([
      { role: 'system', content: 'core' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ])
  })

  it('normalizes legacy Haklex user and assistant bubbles', () => {
    expect(
      compileAgentMessages([
        { type: 'user', content: 'find posts' },
        { type: 'assistant', content: 'I will search.' },
      ]),
    ).toEqual([
      { role: 'user', content: 'find posts' },
      { role: 'assistant', content: 'I will search.' },
    ])
  })

  it('drops UI-only legacy review artifacts', () => {
    expect(
      compileAgentMessages([
        { type: '__agent_review_state__', reviewState: {} },
        { type: 'diff_review', batchId: 'b1' },
        { type: 'tool_call_group', items: [] },
        { type: 'thinking', content: 'private chain' },
      ]),
    ).toEqual([])
  })

  it('compiles frame entries into explicit wire roles', () => {
    expect(
      compileAgentMessages([
        { type: 'core-system', content: 'policy' },
        { type: 'context-snapshot', summary: '3 posts' },
        {
          type: 'tool-result-summary',
          toolCallId: 'tc1',
          toolName: 'searchPosts',
          summary: '2 matches',
        },
      ]),
    ).toEqual([
      { role: 'system', content: 'policy' },
      { role: 'system', content: '3 posts' },
      {
        role: 'tool_result',
        toolCallId: 'tc1',
        toolName: 'searchPosts',
        content: '2 matches',
        isError: false,
      },
    ])
  })

  it('projects approval frames as non-empty model-visible summaries', () => {
    expect(
      compileAgentMessages([
        {
          decision: 'approved',
          dryRunHash: 'hash-1',
          type: 'approval',
        },
      ]),
    ).toEqual([
      {
        role: 'user',
        content:
          '{"decision":"approved","dryRunHash":"hash-1","type":"approval"}',
      },
    ])
  })

  it('does not emit malformed tool results', () => {
    expect(
      compileAgentMessages([
        { type: 'tool_result', summary: 'missing ids' },
        { role: 'tool_result', content: 'missing ids' },
      ]),
    ).toEqual([])
  })
})

describe('buildTitleProjection', () => {
  it('selects the first useful user and assistant exchange', () => {
    expect(
      buildTitleProjection([
        { type: 'core-system', content: 'policy' },
        { type: 'user', content: 'Analyze stale comments' },
        { type: 'thinking', content: 'hidden' },
        { type: 'assistant', content: 'I found 12 comments.' },
        { type: 'user', content: 'next' },
      ]),
    ).toEqual([
      { role: 'user', content: 'Analyze stale comments' },
      { role: 'assistant', content: 'I found 12 comments.' },
    ])
  })
})
