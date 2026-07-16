import { sql } from 'drizzle-orm'
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { readers } from './auth'
import { createdAt, tsCol, updatedAt } from './columns'

export type CompanionDeviceScope =
  | 'companion:presence:write'
  | 'companion:moment:write'
  | 'companion:reading:read'
  | 'companion:reading:write'

export const companionDevices = pgTable(
  'companion_devices',
  {
    // Companion device IDs are public protocol identifiers (UUID today, with
    // room for ULIDs later), rather than internal Snowflake entity IDs.
    id: text('id').primaryKey().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => readers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull(),
    scopes: jsonb('scopes').$type<CompanionDeviceScope[]>().notNull(),
    lastSeenAt: tsCol('last_seen_at'),
    revokedAt: tsCol('revoked_at'),
    presenceClearedAt: tsCol('presence_cleared_at'),
  },
  (table) => [
    uniqueIndex('companion_devices_token_hash_uniq').on(table.tokenHash),
    index('companion_devices_owner_created_idx').on(
      table.ownerId,
      table.createdAt,
    ),
    index('companion_devices_pending_presence_clear_idx')
      .on(table.revokedAt)
      .where(
        sql`${table.revokedAt} is not null and ${table.presenceClearedAt} is null`,
      ),
    check(
      'companion_devices_token_hash_hex_check',
      sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      'companion_devices_scopes_array_check',
      sql`jsonb_typeof(${table.scopes}) = 'array'`,
    ),
  ],
)

export const companionPairings = pgTable(
  'companion_pairings',
  {
    id: text('id').primaryKey().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => readers.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    scopes: jsonb('scopes').$type<CompanionDeviceScope[]>().notNull(),
    expiresAt: tsCol('expires_at').notNull(),
    claimedAt: tsCol('claimed_at'),
  },
  (table) => [
    uniqueIndex('companion_pairings_code_hash_uniq').on(table.codeHash),
    index('companion_pairings_owner_created_idx').on(
      table.ownerId,
      table.createdAt,
    ),
    index('companion_pairings_expires_at_idx').on(table.expiresAt),
    check(
      'companion_pairings_code_hash_hex_check',
      sql`${table.codeHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      'companion_pairings_scopes_array_check',
      sql`jsonb_typeof(${table.scopes}) = 'array'`,
    ),
    check(
      'companion_pairings_expiry_check',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
)
