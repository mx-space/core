import { deleteSay } from '~/api/says'
import { defineCollection } from '~/data/resource/collection'
import type { SayModel } from '~/models/say'

export const says = defineCollection<SayModel>({
  name: 'say',
  getKey: (say) => say.id,
  onDelete: ({ id }) => deleteSay(id),
})
