import { deleteRecently } from '~/api/recently'
import { defineCollection } from '~/data/resource/collection'
import type { RecentlyModel } from '~/models/recently'

export const recentlies = defineCollection<RecentlyModel>({
  name: 'recently',
  getKey: (recently) => recently.id,
  onDelete: ({ id }) => deleteRecently(id),
})
