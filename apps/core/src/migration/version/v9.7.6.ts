import { USER_COLLECTION_NAME } from '~/constants/db.constant'
import type { Db } from 'mongodb'
import { defineMigration } from '../helper'

export default defineMigration('v9.7.6-drop-legacy-users', async (db: Db) => {
  const collections = await db
    .listCollections({ name: USER_COLLECTION_NAME })
    .toArray()
  if (collections.length === 0) {
    return
  }

  await db.collection(USER_COLLECTION_NAME).drop()
})
