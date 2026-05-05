import type * as schema from '@mx-space/db-schema/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export type AppDatabase = NodePgDatabase<typeof schema>
