import type { DraftWriteData } from '~/api/drafts'
import type { DraftModel } from '~/models/draft'

// The legacy write applies `data` as a diff from its base, so the base must be the server's current
// working copy; an older head would replay every accepted edit since it a second time.
export async function resyncRejectedDraft(input: {
  checkpoint: () => Promise<DraftModel>
  data: DraftWriteData
  update: (data: DraftWriteData, headRevisionId: string) => Promise<DraftModel>
}) {
  const pinned = await input.checkpoint()
  return input.update(input.data, pinned.headRevisionId)
}
