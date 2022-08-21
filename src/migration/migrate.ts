import { existsSync } from 'fs-extra'
import { MongoClient } from 'mongodb'

import * as APP_CONFIG from '../app.config'
import { DATA_DIR } from '../constants/path.constant'
import VersionList from './history'

const { MONGO_DB } = APP_CONFIG

export async function migrateDatabase() {
  const migrateFilePath = path.join(DATA_DIR, 'migrate')
  existsSync(migrateFilePath) || (await fs.writeFile(migrateFilePath, ''))

  const migrateRecord = await fs.readFile(migrateFilePath, 'utf-8')

  const migratedSet = new Set(migrateRecord.split('\n'))

  const client = new MongoClient(`mongodb://${MONGO_DB.host}:${MONGO_DB.port}`)
  await client.connect()
  const db = client.db(MONGO_DB.dbName)

  for (const migrate of VersionList) {
    if (migratedSet.has(migrate.name)) {
      continue
    }

    consola.log(`[Database] migrate ${migrate.name}`)

    await migrate(db)
    migratedSet.add(migrate.name)
  }

  await fs.unlink(migrateFilePath)

  await fs.writeFile(migrateFilePath, [...migratedSet].join('\n'), {
    flag: 'w+',
  })

  await client.close()
}
