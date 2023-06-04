// patch for version lower than v2.0.0-alpha.1
import type { Db } from 'mongodb'

export default (async function v200Alpha1(db: Db) {
  return await Promise.all([
    ['notes', 'posts'].map(async (collectionName) => {
      return db
        .collection(collectionName)
        .updateMany({}, { $unset: { options: 1 } })
    }),
    db.collection('categories').updateMany({}, { $unset: { count: '' } }),
  ])
})
