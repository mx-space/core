import { existsSync } from 'fs-extra'

import { isMainProcess } from '~/global/env.global'
import { getDatabaseConnection } from '~/utils/database.util'

import { DATA_DIR } from '../constants/path.constant'
import VersionList from './history'

export async function migrateDatabase() {
  if (!isMainProcess) {
    return
  }

  const migrateFilePath = path.join(DATA_DIR, 'migrate')
  existsSync(migrateFilePath) || (await fs.writeFile(migrateFilePath, ''))

  const migrateRecord = await fs.readFile(migrateFilePath, 'utf-8')

  const migratedSet = new Set(migrateRecord.split('\n'))

  const connection = await getDatabaseConnection()
  const db = connection.db

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
}
