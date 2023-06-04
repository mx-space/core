// patch for version lower than v3.36.0
import type { Db } from 'mongodb'

export default (async function v3360(db: Db) {
  await db.collection('snippets').updateMany(
    {
      type: 'function',
      method: undefined,
      enable: undefined,
    },
    {
      $set: {
        method: 'GET',
        enable: true,
      },
    },
  )
})
