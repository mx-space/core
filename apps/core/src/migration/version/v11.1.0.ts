import type { Db } from 'mongodb'

import {
  NOTE_COLLECTION_NAME,
  PAGE_COLLECTION_NAME,
  POST_COLLECTION_NAME,
} from '~/constants/db.constant'

import { defineMigration } from '../helper'

export default defineMigration(
  'v11.1.0-add-password-and-passwordHint-fields',
  async (db: Db) => {
    const CONTENT_COLLECTIONS = [
      POST_COLLECTION_NAME,
      NOTE_COLLECTION_NAME,
      PAGE_COLLECTION_NAME,
    ]

    for (const collection of CONTENT_COLLECTIONS) {
      const col = db.collection(collection)

      // Add password field if it doesn't exist
      await col.updateMany(
        { password: { $exists: false } },
        { $set: { password: null } },
      )

      // Add passwordHint field if it doesn't exist
      await col.updateMany(
        { passwordHint: { $exists: false } },
        { $set: { passwordHint: null } },
      )
    }
  },
)
