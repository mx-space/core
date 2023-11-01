// patch for version lower than v3.39.0
import type { Db } from 'mongodb'

export default (async function v3390(db: Db) {
  await db.collection('recentlies').updateMany(
    {
      up: { $exists: false },
    },
    {
      $set: {
        up: 0,
        down: 0,
        commentsIndex: 0,
        allowComment: true,
      },
    },
  )
})
