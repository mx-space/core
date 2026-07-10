import type { CreateTopicData } from '~/api/topics'
import { createTopic, deleteTopic } from '~/api/topics'
import { createTransaction } from '~/data/resource/transaction'
import type { TopicModel } from '~/models/topic'

import { topics } from './topic'

export async function saveTopic(
  mode: { kind: 'create' } | { id: string; kind: 'edit' },
  form: CreateTopicData,
): Promise<TopicModel | void> {
  if (mode.kind === 'edit') {
    return topics.update(mode.id, (draft) => {
      draft.name = form.name
      draft.slug = form.slug
      draft.introduce = form.introduce
      draft.description = form.description ?? ''
      draft.icon = form.icon ?? null
    })
  }

  const result = await createTopic(form)
  topics.upsert(result)
  return result
}

export function removeTopic(id: string): Promise<void> {
  return topics.delete(id)
}

export interface BatchRemoveResult {
  failedCount: number
  fulfilledKeys: string[]
  successCount: number
}

export function removeTopics(ids: string[]): Promise<BatchRemoveResult> {
  const tx = createTransaction()
  ids.forEach((id) => tx.delete(topics, id))

  return tx.commit(async () => {
    const results = await Promise.allSettled(ids.map((id) => deleteTopic(id)))
    const fulfilledKeys = ids.filter(
      (_, index) => results[index].status === 'fulfilled',
    )

    return {
      failedCount: ids.length - fulfilledKeys.length,
      fulfilledKeys,
      successCount: fulfilledKeys.length,
    }
  })
}
