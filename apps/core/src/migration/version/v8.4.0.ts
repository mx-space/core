// patch for version lower than v8.4.0
// 本次migration会向posts和notes表中添加一个isPublished字段，默认值为true
import type { Db } from 'mongodb'

export default (async function v0840(db: Db) {
  try {
    const postsCollection = db.collection('posts')
    const notesCollection = db.collection('notes')

    // 添加 isPublished 字段到 posts 集合
    await postsCollection.updateMany(
      {},
      { $set: { isPublished: true } },
      { upsert: false },
    )

    // 添加 isPublished 字段到 notes 集合
    await notesCollection.updateMany(
      {},
      { $set: { isPublished: true } },
      { upsert: false },
    )
  } catch (error) {
    console.error('Migration to v8.4.0 failed:', error)
  }
})
