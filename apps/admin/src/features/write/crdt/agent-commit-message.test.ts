import { describe, expect, it } from 'vitest'

import {
  agentCommitMessage,
  agentTurnMessage,
  agentWriteMessage,
} from './agent-commit-message'

describe('agentCommitMessage', () => {
  it('labels a turn with its request, whitespace folded', () => {
    expect(agentCommitMessage('  tighten the\nintro  ')).toBe(
      'agent:tighten the intro',
    )
  })

  it('caps the summary length', () => {
    expect(agentCommitMessage('a'.repeat(200)).length).toBe(
      'agent:'.length + 60,
    )
  })
})

describe('agentWriteMessage', () => {
  it('numbers each write of a turn', () => {
    expect(agentWriteMessage('agent:fix #3', 2)).toBe('agent:fix #3 #2')
  })

  it('reads the turn back from a numbered write', () => {
    expect(agentTurnMessage(agentWriteMessage('agent:fix #3', 2))).toBe(
      'agent:fix #3',
    )
    expect(agentTurnMessage('agent:fix')).toBe('agent:fix')
  })
})
