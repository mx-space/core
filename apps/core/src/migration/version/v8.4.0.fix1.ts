//patch for version 8.4.0 v1
//移除 Note 中的 isPublished 字段，并将 hide 字段重命名为 isPublished
import type { Db } from 'mongodb'

export default (async function v0840Fix1(db: Db) {
  try {
    const notesCollection = db.collection('notes')

    // 将 hide 字段重命名为 isPublished, 同时将 true 与 false 互换
    await notesCollection.updateMany(
      {},
      [
        {
          $set: {
            isPublished: {
              $cond: {
                if: { $eq: ['$hide', true] },
                then: false,
                else: true,
              },
            },
          },
        },
        { $unset: 'hide' },
      ],
      { upsert: false },
    )
  } catch (error) {
    console.error('Migration v8.4.0 Fix1 failed:', error)
    throw error
  }
})
