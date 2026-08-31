import { deletePost, getPostById, patchPostPublish } from '~/api/posts'
import { createTransaction } from '~/data/resource/transaction'
import type { PostModel } from '~/models/post'

import { posts } from './post'

async function ensurePostHydrated(id: string): Promise<void> {
  if (posts.get(id) !== undefined) return
  const entity = await getPostById(id)
  posts.hydrate([entity])
}

export async function publishPost(
  id: string,
  isPublished: boolean,
): Promise<PostModel> {
  await ensurePostHydrated(id)
  const tx = createTransaction()
  tx.update(posts, id, (draft) => {
    draft.isPublished = isPublished
  })
  const result = await tx.commit(async () => {
    await patchPostPublish(id, isPublished)
    return getPostById(id)
  })
  posts.hydrate([result])
  return result
}

export async function pinPost(
  id: string,
  isPinned: boolean,
): Promise<PostModel | void> {
  await ensurePostHydrated(id)
  return posts.update(id, (draft) => {
    draft.pinAt = isPinned ? new Date().toISOString() : null
  })
}

export async function movePostCategory(
  id: string,
  categoryId: string,
): Promise<PostModel | void> {
  await ensurePostHydrated(id)
  return posts.update(id, (draft) => {
    draft.categoryId = categoryId
  })
}

export function removePost(id: string): Promise<void> {
  return posts.delete(id)
}

export interface BatchRemoveResult {
  failedCount: number
  fulfilledKeys: string[]
  successCount: number
}

export function removePosts(ids: string[]): Promise<BatchRemoveResult> {
  const tx = createTransaction()
  ids.forEach((id) => tx.delete(posts, id))

  return tx.commit(async () => {
    const results = await Promise.allSettled(ids.map((id) => deletePost(id)))
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
