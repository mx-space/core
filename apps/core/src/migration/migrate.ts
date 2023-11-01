import { isMainProcess } from '~/global/env.global'
import { getDatabaseConnection } from '~/utils/database.util'

import VersionList from './history'

export async function migrateDatabase() {
  if (!isMainProcess) {
    return
  }

  const connection = await getDatabaseConnection()
  const db = connection.db

  const migrateCollectionName = 'migrations'

  const migrateArr = await db.collection(migrateCollectionName).find().toArray()
  const migrateMap = new Map(migrateArr.map((m) => [m.name, m]))

  for (const migrate of VersionList) {
    if (migrateMap.has(migrate.name)) {
      continue
    }

    consola.log(`[Database] migrate ${migrate.name}`)

    await migrate(db)

    await db.collection(migrateCollectionName).insertOne({
      name: migrate.name,
      time: Date.now(),
    })
  }
}
