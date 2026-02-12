import type { Db } from 'mongodb'
import { defineMigration } from '../helper'

const RENAMES: [string, string][] = [
  ['metapresets', 'meta_presets'],
  ['serverlessstorages', 'serverless_storages'],
]

export default defineMigration(
  'v9.7.7-1-rename-collections-to-snake-case',
  async (db: Db) => {
    const existing = await db.listCollections().toArray()
    const existingNames = new Set(existing.map((c) => c.name))

    for (const [oldName, newName] of RENAMES) {
      if (!existingNames.has(oldName)) continue
      await db.collection(oldName).rename(newName, { dropTarget: true })
    }
  },
)
