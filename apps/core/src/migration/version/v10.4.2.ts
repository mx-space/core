import type { Db } from 'mongodb'
import { Types } from 'mongoose'

import {
  ACCOUNT_COLLECTION_NAME,
  COMMENT_COLLECTION_NAME,
  READER_COLLECTION_NAME,
} from '~/constants/db.constant'

import { defineMigration } from '../helper'

const buildUserIdCandidates = (id: unknown) => {
  if (!id) return []

  if (id instanceof Types.ObjectId) {
    return [id, id.toHexString()]
  }

  const raw = String(id)
  if (Types.ObjectId.isValid(raw)) {
    return [raw, new Types.ObjectId(raw)]
  }
  return [raw]
}

export default defineMigration('v10.4.2-comment-reader-ref', async (db: Db) => {
  const comments = db.collection(COMMENT_COLLECTION_NAME)
  const readers = db.collection(READER_COLLECTION_NAME)
  const accounts = db.collection(ACCOUNT_COLLECTION_NAME)

  const candidates = await comments
    .find(
      {
        readerId: { $exists: false },
        mail: { $exists: true, $ne: null },
        source: { $exists: true, $ne: null },
      },
      {
        projection: {
          _id: 1,
          mail: 1,
          source: 1,
        },
      },
    )
    .toArray()

  for (const comment of candidates) {
    if (!comment.mail || !comment.source) {
      continue
    }

    const matchedReaders = await readers
      .find(
        { email: comment.mail },
        {
          projection: {
            _id: 1,
            email: 1,
          },
        },
      )
      .toArray()

    if (!matchedReaders.length) {
      continue
    }

    const userIdCandidates = matchedReaders.flatMap((reader) =>
      buildUserIdCandidates(reader._id),
    )

    const relatedAccounts = await accounts
      .find(
        {
          userId: { $in: userIdCandidates },
        },
        {
          projection: {
            userId: 1,
            provider: 1,
            providerId: 1,
          },
        },
      )
      .toArray()

    const matchedReaderIds = matchedReaders
      .filter((reader) => {
        const readerId = reader._id
        const relatedAccount = relatedAccounts.find((account) => {
          const provider = account.provider || account.providerId
          if (provider !== comment.source) {
            return false
          }

          const accountUserId = String(account.userId)
          return (
            accountUserId === String(readerId) ||
            accountUserId === new Types.ObjectId(String(readerId)).toHexString()
          )
        })

        return Boolean(relatedAccount)
      })
      .map((reader) => String(reader._id))

    if (matchedReaderIds.length !== 1) {
      continue
    }

    await comments.updateOne(
      { _id: comment._id },
      {
        $set: { readerId: matchedReaderIds[0], authProvider: comment.source },
        $unset: {
          author: 1,
          mail: 1,
          avatar: 1,
          url: 1,
          source: 1,
        },
      },
    )
  }
})
