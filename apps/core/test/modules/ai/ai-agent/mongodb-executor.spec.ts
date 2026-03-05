import { describe, expect, it, vi } from 'vitest'

import {
  executeMongoConfirmedAction,
  executeMongoTool,
} from '~/modules/ai/ai-agent/tools/connectors/mongodb/executor'

vi.mock('@mariozechner/pi-ai', () => {
  return {
    Type: {
      Object: (value: unknown) => value,
      Optional: (value: unknown) => value,
      String: (value: unknown) => value,
      Array: (value: unknown) => value,
    },
  }
})

describe('mongodb executor security', () => {
  it('blocks writes to ai_agent collections', async () => {
    await expect(
      executeMongoTool({
        db: {} as any,
        sessionId: 's1',
        seq: { value: 1 },
        params: {
          collection: 'ai_agent_messages',
          operation: 'updateOne',
          filter: { _id: 'x' },
          update: { $set: { x: 1 } },
        } as any,
        safeJson: JSON.stringify,
        createPendingAction: async () => ({ id: 'action-1' }),
      }),
    ).rejects.toThrow(/writes to protected collection are blocked/i)
  })

  it('blocks confirmed writes to protected internal collections', async () => {
    const db = {
      collection: vi.fn().mockReturnValue({}),
    } as any

    await expect(
      executeMongoConfirmedAction(db, {
        collection: 'sessions',
        operation: 'deleteMany',
        filter: {},
      } as any),
    ).rejects.toThrow(/writes to protected collection are blocked/i)
  })

  it('allows reads on protected collections', async () => {
    const countDocuments = vi.fn().mockResolvedValue(3)
    const db = {
      collection: vi.fn().mockReturnValue({
        countDocuments,
      }),
    } as any

    const result = await executeMongoTool({
      db,
      sessionId: 's1',
      seq: { value: 1 },
      params: {
        collection: 'ai_agent_messages',
        operation: 'countDocuments',
        filter: { sessionId: 's1' },
      } as any,
      safeJson: JSON.stringify,
      createPendingAction: async () => ({ id: 'action-2' }),
    })

    expect(result.details.result).toEqual({ count: 3 })
    expect(countDocuments).toHaveBeenCalledTimes(1)
  })
})
