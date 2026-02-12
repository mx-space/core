import { randomUUID } from 'node:crypto'
import {
  MIGRATE_COLLECTION_NAME,
  MIGRATION_LOCK_COLLECTION_NAME,
} from '~/constants/db.constant'
import { logger } from '~/global/consola.global'
import { getDatabaseConnection } from '~/utils/database.util'
import type { Db } from 'mongodb'
import VersionList from './history'

const LOCK_ID = 'migrate_lock'
const LOCK_TTL_MS = 5 * 60 * 1000
const POLL_INTERVAL_MS = 2000

const lockOwner = randomUUID()

async function acquireLock(db: Db): Promise<boolean> {
  const now = new Date()
  const expiredBefore = new Date(now.getTime() - LOCK_TTL_MS)

  try {
    const result = await db
      .collection(MIGRATION_LOCK_COLLECTION_NAME)
      .findOneAndUpdate(
        {
          _id: LOCK_ID as any,
          $or: [{ locked: false }, { lockedAt: { $lt: expiredBefore } }],
        },
        { $set: { locked: true, lockedAt: now, owner: lockOwner } },
        { upsert: true, returnDocument: 'after' },
      )
    return !!result
  } catch (error: any) {
    if (error?.code === 11000) return false
    throw error
  }
}

async function releaseLock(db: Db): Promise<void> {
  await db
    .collection(MIGRATION_LOCK_COLLECTION_NAME)
    .updateOne(
      { _id: LOCK_ID as any, owner: lockOwner },
      { $set: { locked: false } },
    )
}

async function waitForMigrationComplete(db: Db): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < LOCK_TTL_MS) {
    const lockDoc = await db
      .collection(MIGRATION_LOCK_COLLECTION_NAME)
      .findOne({ _id: LOCK_ID as any })

    if (!lockDoc || lockDoc.locked === false) return

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }

  throw new Error(
    '[Database] Timed out waiting for migration lock to be released',
  )
}

export async function migrateDatabase() {
  const connection = await getDatabaseConnection()
  const db = connection.db
  if (!db) {
    throw new Error(
      '[Database] Migration failed: database connection not ready',
    )
  }

  const locked = await acquireLock(db)
  if (!locked) {
    logger.log('[Database] Migration is running on another node, waiting...')
    await waitForMigrationComplete(db)
    return
  }

  try {
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
  } finally {
    try {
      await releaseLock(db)
    } catch (releaseError) {
      logger.error('[Database] Failed to release migration lock', releaseError)
    }
  }
}
