import { AUTH_JS_ACCOUNT_COLLECTION } from '~/modules/auth/auth.constant'
import type { Db } from 'mongodb'
import { Types } from 'mongoose'
import { defineMigration } from '../helper'

export default defineMigration(
  'v9.3.2-dedupe-auth-accounts',
  async (db: Db) => {
    const accounts = db.collection(AUTH_JS_ACCOUNT_COLLECTION)

    const cursor = accounts.aggregate<{
      _id: {
        userId: unknown
        providerKey: string | null
        accountKey: string | null
      }
      ids: Array<{ toString: () => string } | string>
    }>([
      {
        $match: {
          userId: { $exists: true },
          $or: [
            { providerId: { $exists: true } },
            { provider: { $exists: true } },
          ],
        },
      },
      {
        $addFields: {
          providerKey: { $ifNull: ['$providerId', '$provider'] },
          accountKey: { $ifNull: ['$accountId', '$providerAccountId'] },
        },
      },
      {
        $group: {
          _id: {
            userId: '$userId',
            providerKey: '$providerKey',
            accountKey: '$accountKey',
          },
          ids: { $push: '$_id' },
        },
      },
      {
        $match: {
          'ids.1': { $exists: true },
        },
      },
    ])

    for await (const group of cursor) {
      const { userId, providerKey, accountKey } = group._id
      if (!providerKey) {
        continue
      }

      const candidateFilter =
        accountKey == null
          ? {
              userId,
              $or: [{ providerId: providerKey }, { provider: providerKey }],
              $and: [
                {
                  $or: [{ accountId: { $exists: false } }, { accountId: null }],
                },
                {
                  $or: [
                    { providerAccountId: { $exists: false } },
                    { providerAccountId: null },
                  ],
                },
              ],
            }
          : {
              userId,
              $and: [
                {
                  $or: [{ providerId: providerKey }, { provider: providerKey }],
                },
                {
                  $or: [
                    { accountId: accountKey },
                    { providerAccountId: accountKey },
                  ],
                },
              ],
            }

      const [keep] = await accounts
        .find(candidateFilter)
        .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
        .limit(1)
        .toArray()

      if (!keep?._id) {
        continue
      }

      const keepId = keep._id.toString()
      const deleteIds = group.ids
        .map((id) => id.toString())
        .filter((id) => id !== keepId)

      if (deleteIds.length === 0) {
        continue
      }

      await accounts.deleteMany({
        _id: { $in: deleteIds.map((id) => new Types.ObjectId(id)) },
      })
    }
  },
)
