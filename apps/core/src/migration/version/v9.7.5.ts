import { AUTH_JS_USER_COLLECTION } from '~/modules/auth/auth.constant'
import type { Db } from 'mongodb'
import { defineMigration } from '../helper'

const OWNER_UNIQUE_INDEX = 'readers_owner_unique_role'

export default defineMigration('v9.7.5-owner-uniqueness', async (db: Db) => {
  const readers = db.collection(AUTH_JS_USER_COLLECTION)

  await readers.updateMany(
    {
      $or: [{ role: { $exists: false } }, { role: null }, { role: '' }],
    },
    { $set: { role: 'reader' } },
  )

  const owners = await readers
    .find({ role: 'owner' }, { projection: { _id: 1 } })
    .sort({ createdAt: 1, _id: 1 })
    .toArray()

  if (owners.length === 0) {
    const fallback = await readers
      .find({}, { projection: { _id: 1 } })
      .sort({ createdAt: 1, _id: 1 })
      .limit(1)
      .next()
    if (fallback?._id) {
      await readers.updateOne(
        { _id: fallback._id },
        { $set: { role: 'owner', updatedAt: new Date() } },
      )
    }
  } else if (owners.length > 1) {
    const [, ...rest] = owners
    await readers.updateMany(
      {
        _id: { $in: rest.map((owner) => owner._id) },
      },
      { $set: { role: 'reader', updatedAt: new Date() } },
    )
  }

  const indexes = await readers.indexes()
  const hasOwnerUniqueIndex = indexes.some(
    (index) => index.name === OWNER_UNIQUE_INDEX,
  )
  if (!hasOwnerUniqueIndex) {
    await readers.createIndex(
      { role: 1 },
      {
        name: OWNER_UNIQUE_INDEX,
        unique: true,
        partialFilterExpression: { role: 'owner' },
      },
    )
  }
})
