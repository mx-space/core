import {
  NOTE_COLLECTION_NAME,
  POST_COLLECTION_NAME,
} from '~/constants/db.constant'
import type { Db } from 'mongodb'

export default (async function v4_6_0__4(db: Db) {
  const countDefault = {
    read: 0,
    like: 0,
  }
  await Promise.all([
    [POST_COLLECTION_NAME, NOTE_COLLECTION_NAME].map((co) => {
      return db.collection(co).updateMany(
        {
          $or: [{ count: { $exists: false } }, { meta: { $exists: false } }],
        },

        [
          {
            $set: {
              count: { $ifNull: ['$count', countDefault] },
              meta: { $ifNull: ['$meta', null] },
            },
          },
        ],
      )
    }),

    db.collection(POST_COLLECTION_NAME).updateMany(
      {
        $or: [
          { summary: { $exists: false } },
          { pin: { $exists: false } },
          {
            related: { $exists: false },
          },
          {
            pinOrder: { $exists: false },
          },
        ],
      },

      [
        {
          $set: {
            summary: { $ifNull: ['$summary', null] },
            pin: { $ifNull: ['$pin', null] },
            related: { $ifNull: ['$related', []] },
            pinOrder: { $ifNull: ['$pinOrder', null] },
          },
        },
      ],
    ),

    db.collection(NOTE_COLLECTION_NAME).updateMany(
      {
        $or: [
          {
            password: { $exists: false },
          },
          {
            password: '',
          },
        ],
      },
      {
        $set: {
          password: null,
        },
      },
    ),
    db.collection(NOTE_COLLECTION_NAME).updateMany(
      {
        $or: [
          { music: { $exists: false } },

          { secret: { $exists: false } },
          { hasMemory: { $exists: false } },
          { topicId: { $exists: false } },
          { mood: { $exists: false } },
          { weather: { $exists: false } },
        ],
      },
      [
        {
          $set: {
            music: { $ifNull: ['$music', []] },

            secret: { $ifNull: ['$secret', null] },
            hasMemory: { $ifNull: ['$hasMemory', false] },
            topicId: { $ifNull: ['$topicId', null] },
            mood: { $ifNull: ['$mood', null] },
            weather: { $ifNull: ['$weather', null] },
          },
        },
      ],
    ),
  ])
})
