import {
  COMMENT_COLLECTION_NAME,
  RECENTLY_COLLECTION_NAME,
} from '~/constants/db.constant'

import { defineMigration } from '../helper'

export default defineMigration('v5.1.1', async (db, connection) => {
  await Promise.all([
    db
      .collection(COMMENT_COLLECTION_NAME)
      .updateMany(
        { refType: 'Recently' },
        { $set: { refType: RECENTLY_COLLECTION_NAME } },
      ),
  ])
})
