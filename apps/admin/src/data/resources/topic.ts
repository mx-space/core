import { deleteTopic, patchTopic } from '~/api/topics'
import { defineCollection } from '~/data/resource/collection'
import type { TopicModel } from '~/models/topic'

export const topics = defineCollection<TopicModel>({
  name: 'topic',
  getKey: (topic) => topic.id,
  onUpdate: ({ id, patch }) => patchTopic(id, patch),
  onDelete: ({ id }) => deleteTopic(id),
})
