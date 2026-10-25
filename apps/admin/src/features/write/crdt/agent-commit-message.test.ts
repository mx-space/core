import { describe, expect, it } from 'vitest'

import { agentCommitMessage } from './agent-commit-message'

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
