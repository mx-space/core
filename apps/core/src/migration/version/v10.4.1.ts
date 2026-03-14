import type { Db } from 'mongodb'
import { Types } from 'mongoose'

import { COMMENT_COLLECTION_NAME } from '~/constants/db.constant'

import { defineMigration } from '../helper'

type LegacyCommentDoc = {
  _id: string | Types.ObjectId
  parent?: string | Types.ObjectId
  children?: string[]
  created?: Date
  isDeleted?: boolean
  rootCommentId?: string | Types.ObjectId | null
  parentCommentId?: string | Types.ObjectId | null
}

const normalizeRelationId = (
  value: string | Types.ObjectId | null | undefined,
): Types.ObjectId | null => {
  if (!value) return null
  if (value instanceof Types.ObjectId) return value
  if (Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value)
  }
  return null
}

export default defineMigration('v10.4.1-flatten-comments', async (db: Db) => {
  const collection = db.collection(COMMENT_COLLECTION_NAME)
  const comments = (await collection
    .find(
      {},
      {
        projection: {
          _id: 1,
          parent: 1,
          children: 1,
          created: 1,
          isDeleted: 1,
          rootCommentId: 1,
          parentCommentId: 1,
        },
      },
    )
    .toArray()) as unknown as LegacyCommentDoc[]

  const hasLegacyTreeFields = comments.some(
    (comment) =>
      'parent' in comment ||
      (Array.isArray(comment.children) && comment.children.length >= 0),
  )

  if (!hasLegacyTreeFields) {
    for (const comment of comments) {
      const parentCommentId = normalizeRelationId(comment.parentCommentId)
      const rootCommentId = parentCommentId
        ? normalizeRelationId(comment.rootCommentId)
        : null

      await collection.updateOne(
        { _id: comment._id as any },
        {
          $set: {
            rootCommentId,
            parentCommentId,
            isDeleted: comment.isDeleted ?? false,
          },
        },
      )
    }

    return
  }

  const commentMap = new Map(
    comments.map((comment) => [String(comment._id), comment]),
  )

  const resolveRootId = (
    comment: LegacyCommentDoc,
  ): LegacyCommentDoc['_id'] => {
    const visited = new Set<string>()
    let current: LegacyCommentDoc | undefined = comment

    while (current?.parent) {
      const parentId = String(current.parent)
      if (visited.has(parentId)) {
        break
      }
      visited.add(parentId)
      current = commentMap.get(parentId)
    }

    return current?._id ?? comment._id
  }

  const threadStats = new Map<
    string,
    { replyCount: number; latestReplyAt?: Date }
  >()

  for (const comment of comments) {
    const commentId = String(comment._id)
    const rootId = resolveRootId(comment)
    const rootKey = String(rootId)
    if (rootKey === commentId) {
      threadStats.set(rootKey, threadStats.get(rootKey) || { replyCount: 0 })
      continue
    }

    const current = threadStats.get(rootKey) || { replyCount: 0 }
    current.replyCount += 1
    if (
      comment.created &&
      (!current.latestReplyAt || comment.created > current.latestReplyAt)
    ) {
      current.latestReplyAt = comment.created
    }
    threadStats.set(rootKey, current)
  }

  for (const comment of comments) {
    const rootId = resolveRootId(comment)
    const commentId = String(comment._id)
    const rootStats = threadStats.get(String(rootId)) || { replyCount: 0 }
    const isTopLevel = !comment.parent

    await collection.updateOne(
      { _id: comment._id as any },
      {
        $set: {
          rootCommentId: isTopLevel ? null : (rootId as any),
          parentCommentId: comment.parent ? (comment.parent as any) : null,
          replyCount: String(rootId) === commentId ? rootStats.replyCount : 0,
          latestReplyAt:
            String(rootId) === commentId ? rootStats.latestReplyAt : undefined,
          isDeleted: comment.isDeleted ?? false,
        },
      },
    )
  }

  await collection.updateMany(
    {},
    {
      $unset: {
        children: 1,
        key: 1,
        commentsIndex: 1,
        parent: 1,
      },
    },
  )
})
