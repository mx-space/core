import {
  COMMENT_COLLECTION_NAME,
  NOTE_COLLECTION_NAME,
  PAGE_COLLECTION_NAME,
  POST_COLLECTION_NAME,
  RECENTLY_COLLECTION_NAME,
} from '~/constants/db.constant'

import { defineMigration } from '../helper'

export default defineMigration('v4.6.2__0', async (db, connection) => {
  const session = await connection.startSession()
  session.startTransaction()
  try {
    await Promise.all([
      db
        .collection(COMMENT_COLLECTION_NAME)
        .updateMany(
          { refType: 'Post' },
          { $set: { refType: POST_COLLECTION_NAME } },
        ),

      db
        .collection(COMMENT_COLLECTION_NAME)
        .updateMany(
          { refType: 'Note' },
          { $set: { refType: NOTE_COLLECTION_NAME } },
        ),

      db
        .collection(COMMENT_COLLECTION_NAME)
        .updateMany(
          { refType: 'Page' },
          { $set: { refType: PAGE_COLLECTION_NAME } },
        ),

      // recently

      db
        .collection(RECENTLY_COLLECTION_NAME)
        .updateMany(
          { refType: 'Post' },
          { $set: { refType: POST_COLLECTION_NAME } },
        ),

      db
        .collection(RECENTLY_COLLECTION_NAME)
        .updateMany(
          { refType: 'Note' },
          { $set: { refType: NOTE_COLLECTION_NAME } },
        ),

      db
        .collection(RECENTLY_COLLECTION_NAME)
        .updateMany(
          { refType: 'Page' },
          { $set: { refType: PAGE_COLLECTION_NAME } },
        ),
    ])

    db.collection(COMMENT_COLLECTION_NAME).updateMany({}, [
      {
        $set: {
          pin: { $ifNull: ['$pin', false] },

          isWhispers: { $ifNull: ['$isWhispers', false] },
          location: { $ifNull: ['$location', null] },
        },
      },
    ])
    await session.commitTransaction()
  } catch {
    await session.abortTransaction()

    console.error('v4.6.2 migration failed')
  } finally {
    session.endSession()
  }
})
