import { Type } from 'typebox'
import { describe, expect, it, vi } from 'vitest'

import { invokeSubAgent } from '~/modules/ai/message-engine/tools/sub-agent'
import { firstSchemaFailure } from '~/modules/ai/message-engine/tools/tool.types'

const schema = Type.Object(
  { issues: Type.Array(Type.String()) },
  { additionalProperties: false },
)

const runtimeWith = (output: unknown) =>
  ({
    providerInfo: { id: 'stub', type: 'openai-compatible', model: 'stub' },
    generateText: vi.fn(),
    generateStructured: vi.fn(async () => ({ output })),
  }) as any

describe('invokeSubAgent', () => {
  it('returns validated structured output', async () => {
    const runtime = runtimeWith({ issues: ['a'] })
    const result = await invokeSubAgent(
      { runtime, systemPrompt: 'SYS' },
      { prompt: 'P', schema },
    )
    expect(result).toEqual({ issues: ['a'] })
    expect(runtime.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: 'SYS',
        prompt: 'P',
        validate: false,
      }),
    )
  })

  it('reports usage without exposing provider result details', async () => {
    const runtime = runtimeWith({ issues: [] })
    runtime.generateStructured = vi.fn(async () => ({
      output: { issues: [] },
      usage: { completionTokens: 7, costBreakdown: { total: 0.02 } },
    }))
    const onUsage = vi.fn()
    await invokeSubAgent(
      { runtime, systemPrompt: 'SYS' },
      { prompt: 'P', schema, onUsage },
    )
    expect(onUsage).toHaveBeenCalledWith({
      completionTokens: 7,
      costBreakdown: { total: 0.02 },
    })
  })

  it('throws with the failing path on schema mismatch', async () => {
    const runtime = runtimeWith({ issues: 'not-an-array' })
    await expect(
      invokeSubAgent({ runtime, systemPrompt: 'SYS' }, { prompt: 'P', schema }),
    ).rejects.toThrow(/issues/)
  })

  it('propagates runtime errors', async () => {
    const runtime = runtimeWith(null)
    runtime.generateStructured = vi.fn(async () => {
      throw new Error('provider down')
    })
    await expect(
      invokeSubAgent({ runtime, systemPrompt: 'SYS' }, { prompt: 'P', schema }),
    ).rejects.toThrow('provider down')
  })
})

describe('firstSchemaFailure', () => {
  it('names the failing path', () => {
    const s = Type.Object({ a: Type.String() }, { additionalProperties: false })
    expect(firstSchemaFailure(s, { a: 1 })).toContain('/a')
  })
})
