import { MIGRATE_COLLECTION_NAME } from '~/constants/db.constant'
import { logger } from '~/global/consola.global'
import { getDatabaseConnection } from '~/utils/database.util'
import VersionList from './history'

export async function migrateDatabase() {
  const connection = await getDatabaseConnection()
  const db = connection.db!

  const migrateArr = await db
    .collection(MIGRATE_COLLECTION_NAME)
    .find()
    .toArray()
  const migrateMap = new Map(migrateArr.map((m) => [m.name, m]))

  for (const migrate of VersionList) {
    if (migrateMap.has(migrate.name)) {
      continue
    }

    logger.log(`[Database] migrate ${migrate.name}`)
    try {
      if (typeof migrate === 'function') {
        await migrate(db)
      } else {
        await migrate.run(db, connection)
      }
    } catch (error) {
      logger.error(`[Database] migrate ${migrate.name} failed`, error)
      throw error
    }

    await db.collection(MIGRATE_COLLECTION_NAME).insertOne({
      name: migrate.name,
      time: Date.now(),
    })
  }
}
