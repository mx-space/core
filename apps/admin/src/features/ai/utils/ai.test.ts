import { describe, expect, it } from 'vitest'

import { buildTtsRegeneratePayload, summarizeTaskBatch } from './ai'

const fulfilled = (
  created: boolean,
): PromiseSettledResult<{
  created: boolean
}> => ({ status: 'fulfilled', value: { created } })

const rejected = (
  reason: unknown,
): PromiseSettledResult<{ created: boolean }> => ({
  status: 'rejected',
  reason,
})

const describeError = (error: unknown) =>
  error instanceof Error ? error.message : 'failed'

describe('buildTtsRegeneratePayload', () => {
  it('forces regeneration and scopes the task to the row language', () => {
    expect(buildTtsRegeneratePayload({ lang: 'zh', refId: '42' })).toEqual({
      force: true,
      langs: ['zh'],
      refId: '42',
    })
  })

  it('always sets force, so an unchanged article still re-synthesizes', () => {
    // Without this the management page's batch action is a no-op by
    // construction: every row it can act on already has narration.
    expect(buildTtsRegeneratePayload({ lang: 'en', refId: '7' }).force).toBe(
      true,
    )
  })
})

describe('summarizeTaskBatch', () => {
  it('counts only created responses as queued', () => {
    expect(
      summarizeTaskBatch(
        [fulfilled(true), fulfilled(false), fulfilled(true)],
        describeError,
      ),
    ).toEqual({ deduped: 1, queued: 2, reasons: [] })
  })

  it('reports a batch that only hit dedup as nothing queued', () => {
    expect(
      summarizeTaskBatch([fulfilled(false), fulfilled(false)], describeError),
    ).toEqual({ deduped: 2, queued: 0, reasons: [] })
  })

  it('keeps failure reasons and dedupes identical ones', () => {
    expect(
      summarizeTaskBatch(
        [
          rejected(new Error('tts disabled')),
          rejected(new Error('tts disabled')),
          rejected(new Error('provider not configured')),
          fulfilled(true),
        ],
        describeError,
      ),
    ).toEqual({
      deduped: 0,
      queued: 1,
      reasons: ['tts disabled', 'provider not configured'],
    })
  })
})
