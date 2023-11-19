import { MIGRATE_COLLECTION_NAME } from '~/constants/db.constant'
import { isMainProcess } from '~/global/env.global'
import { getDatabaseConnection } from '~/utils/database.util'

import VersionList from './history'

export async function migrateDatabase() {
  if (!isMainProcess) {
    return
  }

  const connection = await getDatabaseConnection()
  const db = connection.db

  const migrateArr = await db
    .collection(MIGRATE_COLLECTION_NAME)
    .find()
    .toArray()
  const migrateMap = new Map(migrateArr.map((m) => [m.name, m]))

  for (const migrate of VersionList) {
    if (migrateMap.has(migrate.name)) {
      continue
    }

    consola.log(`[Database] migrate ${migrate.name}`)
    if (typeof migrate === 'function') {
      await migrate(db)
    } else {
      await migrate.run(db, connection)
    }

    await db.collection(MIGRATE_COLLECTION_NAME).insertOne({
      name: migrate.name,
      time: Date.now(),
    })
  }
}
