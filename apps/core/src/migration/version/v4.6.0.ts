// patch for version lower than v4.6.0

import {
  NOTE_COLLECTION_NAME,
  PAGE_COLLECTION_NAME,
} from '~/constants/db.constant'
import type { Db } from 'mongodb'

export default (async function v4_6_0(db: Db) {
  await Promise.all([
    // 0. rename Note collection identifycounts
    db.collection('identitycounters').updateOne(
      {
        modelName: 'Note',
      },
      {
        $set: {
          modelName: NOTE_COLLECTION_NAME,
        },
      },
    ),

    // 1. delete page `type` field
    db.collection(PAGE_COLLECTION_NAME).updateMany(
      {
        type: { $exists: true },
      },
      {
        $unset: {
          type: 1,
        },
      },
    ),
  ])

  // // 2. checksum

  // const checksumCollectionIsExist =
  //   (await db.collection(CHECKSUM_COLLECTION_NAME).countDocuments()) > 0
  // if (checksumCollectionIsExist) {
  //   await db.collection(CHECKSUM_COLLECTION_NAME).drop()
  // }
  // await db
  //   .collection(CHECKSUM_COLLECTION_NAME)
  //   .createIndex({ refId: 1 }, { unique: true })

  // const insertedChecksumRecords = [] as { refId: string; checksum: string }[]
  // await Promise.all(
  //   [
  //     CATEGORY_COLLECTION_NAME,
  //     NOTE_COLLECTION_NAME,
  //     PAGE_COLLECTION_NAME,
  //     POST_COLLECTION_NAME,
  //     TOPIC_COLLECTION_NAME,
  //   ].map(async (collectionName) => {
  //     for await (const cur of db.collection(collectionName).find()) {
  //       insertedChecksumRecords.push({
  //         refId: cur._id.toHexString(),
  //         checksum: md5(JSON.stringify(cur)),
  //       })
  //     }
  //   }),
  // )

  // if (insertedChecksumRecords.length === 0) {
  //   return
  // }
  // await db
  //   .collection(CHECKSUM_COLLECTION_NAME)
  //   .insertMany(insertedChecksumRecords)
})
