// patch for version 8.4.0 v2
// 将 Posts 中的 isPublished 字段全部设置为 true
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
