import { deleteTopic, updateTopic } from '~/api/topics'
import { defineCollection } from '~/data/resource/collection'
import type { TopicModel } from '~/models/topic'

export const topics = defineCollection<TopicModel>({
  name: 'topic',
  getKey: (topic) => topic.id,
  onUpdate: ({ id, next }) =>
    updateTopic(id, {
      description: next.description ?? undefined,
      icon: next.icon || undefined,
      introduce: next.introduce ?? '',
      name: next.name,
      slug: next.slug,
    }),
  onDelete: ({ id }) => deleteTopic(id),
})
