// patch for version lower than v7.2.1
import type { Db } from 'mongodb'

export default (async function v0721(db: Db) {
  try {
    await db.collection('session').drop()
  } catch {}
})
