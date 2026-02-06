import { USER_COLLECTION_NAME } from '~/constants/db.constant'
import type { Db } from 'mongodb'
import { defineMigration } from '../helper'

export default defineMigration(
  'v9.7.2-remove-user-api-token',
  async (db: Db) => {
    await db.collection(USER_COLLECTION_NAME).updateMany(
      {},
      {
        $unset: {
          apiToken: '',
        },
      },
    )
  },
)
