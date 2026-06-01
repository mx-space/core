// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { validateDryRunApproval } from './approval'
import type { AgentToolDefinition } from './turn-loop'

function tool(
  hash: string,
  blockingReasons: string[] = [],
): AgentToolDefinition {
  return {
    kind: 'draftPatch',
    manifest: {
      description: 'Draft patch',
      name: 'draftPostPatch',
      parameters: {},
    },
    dryRun: async () => ({
      blockingReasons,
      dryRunHash: hash,
      summary: 'summary',
    }),
  }
}

describe('validateDryRunApproval', () => {
  it('accepts an unchanged dry-run hash', async () => {
    await expect(
      validateDryRunApproval(
        {
          arguments: { postIds: ['p1'] },
          dryRunHash: 'hash-1',
          toolCallId: 'tc1',
        },
        tool('hash-1'),
      ),
    ).resolves.toEqual({
      args: { postIds: ['p1'] },
      ok: true,
    })
  })

  it('rejects a changed dry-run hash', async () => {
    await expect(
      validateDryRunApproval(
        {
          arguments: { postIds: ['p1'] },
          dryRunHash: 'old-hash',
          toolCallId: 'tc1',
        },
        tool('new-hash'),
      ),
    ).resolves.toEqual({
      ok: false,
      reason: 'Dry run changed. Run the request again before approval.',
    })
  })

  it('rejects blocking reasons from the current dry run', async () => {
    await expect(
      validateDryRunApproval(
        {
          arguments: { postIds: [] },
          dryRunHash: 'hash-1',
          toolCallId: 'tc1',
        },
        tool('hash-1', ['No post ids were provided.']),
      ),
    ).resolves.toEqual({
      ok: false,
      reason: 'No post ids were provided.',
    })
  })
})
