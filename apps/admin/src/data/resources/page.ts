import { deletePage } from '~/api/pages'
import { defineCollection } from '~/data/resource/collection'
import type { PageModel } from '~/models/page'

export const pages = defineCollection<PageModel>({
  name: 'page',
  getKey: (page) => page.id,
  onDelete: ({ id }) => deletePage(id),
})
