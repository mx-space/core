import { NOTE_COLLECTION_NAME } from '~/constants/db.constant'
import { defineMigration } from '../helper'

export default defineMigration('v5.0.0-1', async (db) => {
  try {
    await Promise.all([
      db.collection(NOTE_COLLECTION_NAME).updateMany(
        {
          secret: { $exists: true },
        },
        { $rename: { secret: 'publicAt' } },
      ),
      db.collection(NOTE_COLLECTION_NAME).updateMany(
        {
          hasMemory: { $exists: true },
        },
        { $rename: { hasMemory: 'bookmark' } },
      ),
    ])

    await db.collection(NOTE_COLLECTION_NAME).updateMany(
      {
        bookmark: { $exists: false },
      },
      {
        $set: {
          bookmark: false,
        },
      },
    )
  } catch (error) {
    console.error('v5.0.0-1 migration failed')

    throw error
  }
})
