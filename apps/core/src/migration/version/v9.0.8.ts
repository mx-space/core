import { DRAFT_COLLECTION_NAME } from '~/constants/db.constant'
import type { Db } from 'mongodb'
import { defineMigration } from '../helper'

export default defineMigration(
  'v9.0.8-draft-history-is-full-snapshot',
  async (db: Db) => {
    const drafts = db.collection(DRAFT_COLLECTION_NAME)

    await drafts.updateMany(
      {
        history: { $elemMatch: { isFullSnapshot: { $exists: false } } },
      },
      {
        $set: { 'history.$[h].isFullSnapshot': true },
      },
      {
        arrayFilters: [{ 'h.isFullSnapshot': { $exists: false } }],
      },
    )
  },
)
