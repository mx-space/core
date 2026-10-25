import { describe, expect, it } from 'vitest'

import { agentTurnMessage, pendingReviewBatchIds } from './use-crdt-agent-turns'

describe('agentTurnMessage', () => {
  it('labels a running turn with the latest user request', () => {
    expect(
      agentTurnMessage({
        bubbles: [
          { content: 'first', type: 'user' },
          { content: 'ok', type: 'assistant' },
          { content: '  tighten the\nintro  ', type: 'user' },
        ],
        status: 'writing',
      }),
    ).toBe('agent:tighten the intro')
  })

  it('returns null once the agent is idle', () => {
    expect(
      agentTurnMessage({
        bubbles: [{ content: 'x', type: 'user' }],
        status: 'done',
      }),
    ).toBeNull()
  })

  it('caps the summary length', () => {
    const message = agentTurnMessage({
      bubbles: [{ content: 'a'.repeat(200), type: 'user' }],
      status: 'running',
    })

    expect(message!.length).toBeLessThanOrEqual('agent:'.length + 60)
  })
})

describe('pendingReviewBatchIds', () => {
  it('lists only batches still waiting for review', () => {
    expect(
      pendingReviewBatchIds({
        batches: [
          { id: 'a', status: 'pending' },
          { id: 'b', status: 'accepted' },
          { id: 'c', status: 'pending' },
        ],
      } as never),
    ).toEqual(['a', 'c'])
  })

  it('handles an empty review state', () => {
    expect(pendingReviewBatchIds(null)).toEqual([])
  })
})
