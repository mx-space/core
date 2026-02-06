import { READER_COLLECTION_NAME } from '~/constants/db.constant'
import type { Db } from 'mongodb'
import { defineMigration } from '../helper'

export default defineMigration('v9.7.3-role-migration', async (db: Db) => {
  const readers = db.collection(READER_COLLECTION_NAME)

  await readers.updateMany({ isOwner: true }, { $set: { role: 'owner' } })

  await readers.updateMany(
    {
      $or: [{ role: { $exists: false } }, { role: null }, { role: '' }],
    },
    { $set: { role: 'reader' } },
  )

  await readers.updateMany({}, { $unset: { isOwner: '' } })
})
