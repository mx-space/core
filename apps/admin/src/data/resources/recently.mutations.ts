import type { RecentlyInput } from '~/api/recently'
import { createRecently, updateRecently } from '~/api/recently'
import { createTransaction } from '~/data/resource/transaction'
import type { EnrichmentResult } from '~/models/enrichment'
import type { RecentlyModel } from '~/models/recently'

import { recentlies } from './recently'

export async function saveRecently(
  mode: { kind: 'create' } | { id: string; kind: 'edit' },
  input: RecentlyInput,
): Promise<RecentlyModel> {
  if (mode.kind === 'edit') {
    const { id } = mode
    const tx = createTransaction()
    tx.update(recentlies, id, (draft) => {
      draft.content = input.content
    })
    const result = await tx.commit(() => updateRecently(id, input))
    recentlies.hydrate([result])
    return result
  }

  const result = await createRecently(input)
  recentlies.upsert(result)
  return result
}

export function removeRecently(id: string): Promise<void> {
  return recentlies.delete(id)
}

export function applyRecentlyEnrichment(
  id: string,
  url: string,
  enrichment: EnrichmentResult,
): void {
  const current = recentlies.get(id)
  if (!current) return

  recentlies.upsert({
    ...current,
    enrichments: { ...current.enrichments, [url]: enrichment },
  })
}
