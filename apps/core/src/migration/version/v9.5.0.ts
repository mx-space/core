import {
  AI_TRANSLATION_COLLECTION_NAME,
  CollectionRefTypes,
  NOTE_COLLECTION_NAME,
  POST_COLLECTION_NAME,
} from '~/constants/db.constant'
import { ObjectId } from 'mongodb'
import type { Db } from 'mongodb'
import { Types } from 'mongoose'
import { defineMigration } from '../helper'

export default defineMigration(
  'v9.5.0-backfill-translation-sourceModified',
  async (db: Db) => {
    const translationsCollection = db.collection(AI_TRANSLATION_COLLECTION_NAME)
    const postsCollection = db.collection(POST_COLLECTION_NAME)
    const notesCollection = db.collection(NOTE_COLLECTION_NAME)

    const translations = await translationsCollection
      .find({
        sourceModified: { $exists: false },
        refType: { $in: [CollectionRefTypes.Post, CollectionRefTypes.Note] },
      })
      .project({ _id: 1, refId: 1, refType: 1 })
      .toArray()

    if (!translations.length) return

    const postIdMap = new Map<string, ObjectId>()
    const noteIdMap = new Map<string, ObjectId>()

    for (const translation of translations) {
      if (!ObjectId.isValid(translation.refId)) {
        continue
      }
      if (translation.refType === CollectionRefTypes.Post) {
        postIdMap.set(translation.refId, new Types.ObjectId(translation.refId))
      } else if (translation.refType === CollectionRefTypes.Note) {
        noteIdMap.set(translation.refId, new Types.ObjectId(translation.refId))
      }
    }

    const [posts, notes] = await Promise.all([
      postIdMap.size
        ? postsCollection
            .find({ _id: { $in: [...postIdMap.values()] } })
            .project({ _id: 1, modified: 1 })
            .toArray()
        : [],
      noteIdMap.size
        ? notesCollection
            .find({ _id: { $in: [...noteIdMap.values()] } })
            .project({ _id: 1, modified: 1 })
            .toArray()
        : [],
    ])

    const modifiedMap = new Map<string, Date>()
    for (const post of posts) {
      if (post.modified) modifiedMap.set(post._id.toString(), post.modified)
    }
    for (const note of notes) {
      if (note.modified) modifiedMap.set(note._id.toString(), note.modified)
    }

    const bulkOps = translations
      .filter((translation) => modifiedMap.has(translation.refId))
      .map((translation) => ({
        updateOne: {
          filter: { _id: translation._id },
          update: {
            $set: { sourceModified: modifiedMap.get(translation.refId) },
          },
        },
      }))

    if (bulkOps.length) {
      await translationsCollection.bulkWrite(bulkOps)
    }
  },
)
