// patch for version lower than v3.36.0
import { Db } from 'mongodb'

export default (async function v3360(db: Db) {
  await db.collection('snippets').updateMany(
    {
      type: 'function',
    },
    {
      $set: {
        method: 'GET',
        enable: true,
      },
    },
  )
})
