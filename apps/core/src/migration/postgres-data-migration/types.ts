import type { Db, ObjectId } from 'mongodb'

import type { AppDatabase } from '~/processors/database/postgres.provider'
import type { SnowflakeGenerator } from '~/shared/id/snowflake.service'

export type MigrationMode = 'dry-run' | 'apply'

export interface MigrationContext {
  mode: MigrationMode
  mongo: Db
  pg: AppDatabase
  snowflake: SnowflakeGenerator
  /** Map collection name → Mongo `_id` hex → Snowflake bigint. */
  idMap: Map<string, Map<string, bigint>>
  reports: MigrationReport
}

export interface MigrationReport {
  rowsRead: Record<string, number>
  rowsLoaded: Record<string, number>
  missingRefs: Array<{ collection: string; field: string; mongoId: string }>
  duplicateKeys: Array<{ collection: string; key: string }>
  warnings: Array<{ collection: string; mongoId: string; reason: string }>
  startedAt: Date
  finishedAt?: Date
}

export interface MigrationStep {
  name: string
  /** Collections this step depends on; ensures id-map allocation runs first. */
  dependsOn?: string[]
  /** Allocate Snowflake IDs from this collection; populates `idMap`. */
  allocate?: (ctx: MigrationContext) => Promise<void>
  /** Load rows into PG using ids from `idMap`. */
  load?: (ctx: MigrationContext) => Promise<void>
}

export type MongoDocWithId = { _id: ObjectId | string } & Record<
  string,
  unknown
>
