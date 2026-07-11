import type { CreatePageData } from '~/api/pages'
import { createPage, reorderPages, updatePage } from '~/api/pages'
import { createTransaction } from '~/data/resource/transaction'
import type { PageModel } from '~/models/page'

import { pages } from './page'

export function removePage(id: string): Promise<void> {
  return pages.delete(id)
}

function toOptimisticPagePatch(data: CreatePageData): Partial<PageModel> {
  const patch: Partial<PageModel> = {
    contentFormat: data.contentFormat,
    meta: data.meta,
    slug: data.slug,
    subtitle: data.subtitle,
    text: data.text,
    title: data.title,
  }
  if (data.content !== undefined) patch.content = data.content
  if (data.images !== undefined) patch.images = data.images
  if (data.order !== undefined) patch.order = data.order
  return patch
}

export async function savePage(
  id: string,
  data: CreatePageData,
): Promise<PageModel> {
  if (!id) {
    const result = await createPage(data)
    pages.upsert(result)
    return result
  }

  const patch = toOptimisticPagePatch(data)
  const tx = createTransaction()
  tx.update(pages, id, (draft) => {
    Object.assign(draft, patch)
  })
  const result = await tx.commit(() => updatePage(id, data))
  pages.hydrate([result])
  return result
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
