// patch for version 8.4.0 v2
// 将Posts中的isPublished字段全部设置为true
import type { Db } from 'mongodb'

export default (async function v0840Fix2(db: Db) {
  try {
    const postsCollection = db.collection('posts')

    await postsCollection.updateMany(
      {},
      { $set: { isPublished: true } },
      { upsert: false },
    )
  } catch (error) {
    console.error('Migration v8.4.0 Fix2 failed:', error)
    throw error
  }
})
