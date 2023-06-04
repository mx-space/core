// patch for version lower than v3.30.0
import type { Db } from 'mongodb'

export default (async function v3330(db: Db) {
  await db.collection('users').updateMany({}, { $unset: { authCode: 1 } })
})
