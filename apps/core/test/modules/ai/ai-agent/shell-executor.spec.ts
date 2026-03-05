import { describe, expect, it, vi } from 'vitest'

import { executeShellTool } from '~/modules/ai/ai-agent/tools/connectors/shell/executor'

vi.mock('@mariozechner/pi-ai', () => {
  return {
    Type: {
      Object: (value: unknown) => value,
      Optional: (value: unknown) => value,
      String: (value: unknown) => value,
    },
  }
})

describe('shell executor security', () => {
  it('requires confirmation for shell control operators', async () => {
    const result = await executeShellTool({
      sessionId: 's1',
      seq: { value: 1 },
      params: {
        command: 'ls; echo hacked',
      },
      safeJson: JSON.stringify,
      createPendingAction: async () => ({ id: 'action-1' }),
    })

    expect(result.details.pendingConfirmation).toBe(true)
  })

  it('requires confirmation for sensitive file reads', async () => {
    const result = await executeShellTool({
      sessionId: 's1',
      seq: { value: 1 },
      params: {
        command: 'cat .env',
      },
      safeJson: JSON.stringify,
      createPendingAction: async () => ({ id: 'action-2' }),
    })

    expect(result.details.pendingConfirmation).toBe(true)
  })

  it('blocks dangerous commands', async () => {
    await expect(
      executeShellTool({
        sessionId: 's1',
        seq: { value: 1 },
        params: {
          command: 'rm -rf /',
        },
        safeJson: JSON.stringify,
        createPendingAction: async () => ({ id: 'action-3' }),
      }),
    ).rejects.toThrow(/blocked by policy/i)
  })
})
