import { reorderPages } from '~/api/pages'
import { createTransaction } from '~/data/resource/transaction'

import { pages } from './page'

export function removePage(id: string): Promise<void> {
  return pages.delete(id)
}

export function reorderPagesOptimistic(
  seq: Array<{ id: string; order: number }>,
): Promise<void> {
  const tx = createTransaction()
  seq.forEach(({ id, order }) => {
    tx.update(pages, id, (draft) => {
      draft.order = order
    })
  })
  return tx.commit(() => reorderPages(seq))
}
