import type { CreatePostData } from '~/api/posts'
import { createPost, deletePost, getPostById, updatePost } from '~/api/posts'
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
): Promise<PostModel | void> {
  await ensurePostHydrated(id)
  return posts.update(id, (draft) => {
    draft.isPublished = isPublished
  })
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

function toOptimisticPostPatch(data: CreatePostData): Partial<PostModel> {
  const patch: Partial<PostModel> = {
    categoryId: data.categoryId,
    contentFormat: data.contentFormat,
    copyright: data.copyright,
    isPublished: data.isPublished,
    meta: data.meta,
    pinAt: data.pin,
    pinOrder: data.pinOrder,
    slug: data.slug,
    summary: data.summary,
    tags: data.tags,
    text: data.text,
    title: data.title,
  }
  if (data.content !== undefined) patch.content = data.content
  if (data.images !== undefined) patch.images = data.images
  return patch
}

export async function savePost(
  id: string,
  data: CreatePostData,
): Promise<PostModel> {
  if (!id) {
    const result = await createPost(data)
    posts.upsert(result)
    return result
  }

  await ensurePostHydrated(id)
  const patch = toOptimisticPostPatch(data)
  const tx = createTransaction()
  tx.update(posts, id, (draft) => {
    Object.assign(draft, patch)
  })
  const result = await tx.commit(() => updatePost(id, data))
  posts.hydrate([result])
  return result
}
