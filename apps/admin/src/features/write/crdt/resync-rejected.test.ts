import { describe, expect, it, vi } from 'vitest'

import type { DraftWriteData } from '~/api/drafts'
import type { DraftModel } from '~/models/draft'

import { resyncRejectedDraft } from './resync-rejected'

const draftWithHead = (headRevisionId: string) =>
  ({ headRevisionId, id: 'd1' }) as DraftModel

describe('resyncRejectedDraft', () => {
  it('pins the server working copy first and writes local content on top of it', async () => {
    const calls: string[] = []
    const checkpoint = vi.fn(async () => {
      calls.push('checkpoint')
      return draftWithHead('rev-now')
    })
    const update = vi.fn(async (_data: DraftWriteData, head: string) => {
      calls.push(`update:${head}`)
      return draftWithHead('rev-merged')
    })
    const data = { content: '{}', title: 'T' } as DraftWriteData

    const result = await resyncRejectedDraft({ checkpoint, data, update })

    expect(calls).toEqual(['checkpoint', 'update:rev-now'])
    expect(update).toHaveBeenCalledWith(data, 'rev-now')
    expect(result.headRevisionId).toBe('rev-merged')
  })
})
