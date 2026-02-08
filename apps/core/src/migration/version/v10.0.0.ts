import type { Db } from 'mongodb'
import { defineMigration } from '../helper'

const COLLECTIONS = ['posts', 'notes', 'pages', 'drafts', 'ai_translations']

export default defineMigration(
  'v10.0.0-add-content-format-field',
  async (db: Db) => {
    for (const collection of COLLECTIONS) {
      const col = db.collection(collection)
      await col.updateMany(
        { contentFormat: { $exists: false } },
        { $set: { contentFormat: 'markdown' } },
      )
    }
  },
)
