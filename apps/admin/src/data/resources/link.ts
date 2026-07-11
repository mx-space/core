import { deleteLink } from '~/api/links'
import { defineCollection } from '~/data/resource/collection'
import type { LinkModel } from '~/models/link'

export const links = defineCollection<LinkModel>({
  name: 'link',
  getKey: (link) => link.id,
  onDelete: async ({ id }) => {
    await deleteLink(id)
  },
})
