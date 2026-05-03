import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { createdAt, tsCol, updatedAt } from './columns'

export const readers = pgTable(
  'readers',
  {
    id: text('id').primaryKey().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    email: text('email'),
    emailVerified: boolean('email_verified').notNull().default(false),
    name: text('name'),
    handle: text('handle'),
    username: text('username'),
    displayUsername: text('display_username'),
    image: text('image'),
    role: text('role').notNull().default('reader'),
  },
  (table) => [
    uniqueIndex('readers_email_uniq')
      .on(table.email)
      .where(sql`${table.email} is not null`),
    uniqueIndex('readers_username_uniq')
      .on(table.username)
      .where(sql`${table.username} is not null`),
    index('readers_role_idx').on(table.role),
  ],
)

export const ownerProfiles = pgTable(
  'owner_profiles',
  {
    id: text('id').primaryKey().notNull(),
    createdAt: createdAt(),
    readerId: text('reader_id')
      .notNull()
      .references(() => readers.id, { onDelete: 'cascade' }),
    mail: text('mail'),
    url: text('url'),
    introduce: text('introduce'),
    lastLoginIp: text('last_login_ip'),
    lastLoginTime: tsCol('last_login_time'),
    socialIds: jsonb('social_ids').$type<Record<string, unknown> | null>(),
  },
  (table) => [uniqueIndex('owner_profiles_reader_id_uniq').on(table.readerId)],
)

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    userId: text('user_id')
      .notNull()
      .references(() => readers.id, { onDelete: 'cascade' }),
    accountId: text('account_id'),
    providerId: text('provider_id').notNull(),
    providerAccountId: text('provider_account_id'),
    password: text('password'),
    type: text('type'),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: tsCol('access_token_expires_at'),
    refreshTokenExpiresAt: tsCol('refresh_token_expires_at'),
    scope: text('scope'),
    idToken: text('id_token'),
    raw: jsonb('raw').$type<Record<string, unknown> | null>(),
  },
  (table) => [
    uniqueIndex('accounts_provider_uniq').on(
      table.providerId,
      table.providerAccountId,
    ),
    index('accounts_user_id_idx').on(table.userId),
  ],
)

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    userId: text('user_id')
      .notNull()
      .references(() => readers.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: tsCol('expires_at'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    provider: text('provider'),
  },
  (table) => [
    uniqueIndex('sessions_token_uniq').on(table.token),
    index('sessions_user_id_idx').on(table.userId),
  ],
)

export const apiKeys = pgTable(
  'api_keys',
  {
    id: text('id').primaryKey().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    userId: text('user_id').references(() => readers.id, {
      onDelete: 'cascade',
    }),
    referenceId: text('reference_id').references(() => readers.id, {
      onDelete: 'cascade',
    }),
    configId: text('config_id'),
    name: text('name'),
    key: text('key').notNull(),
    start: text('start'),
    prefix: text('prefix'),
    enabled: boolean('enabled').notNull().default(true),
    rateLimitEnabled: boolean('rate_limit_enabled').notNull().default(false),
    rateLimitTimeWindow: integer('rate_limit_time_window'),
    rateLimitMax: integer('rate_limit_max'),
    requestCount: integer('request_count').notNull().default(0),
    remaining: integer('remaining'),
    refillInterval: integer('refill_interval'),
    refillAmount: integer('refill_amount'),
    expiresAt: tsCol('expires_at'),
    lastRefillAt: tsCol('last_refill_at'),
    lastRequest: tsCol('last_request'),
    permissions: jsonb('permissions').$type<unknown>(),
    metadata: jsonb('metadata').$type<unknown>(),
  },
  (table) => [
    uniqueIndex('api_keys_key_uniq').on(table.key),
    index('api_keys_user_id_idx').on(table.userId),
  ],
)

export const passkeys = pgTable(
  'passkeys',
  {
    id: text('id').primaryKey().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    userId: text('user_id')
      .notNull()
      .references(() => readers.id, { onDelete: 'cascade' }),
    name: text('name'),
    credentialId: text('credential_id').notNull(),
    publicKey: text('public_key').notNull(),
    counter: integer('counter').notNull().default(0),
    deviceType: text('device_type'),
    backedUp: boolean('backed_up').notNull().default(false),
    transports: text('transports').array(),
    aaguid: text('aaguid'),
  },
  (table) => [
    uniqueIndex('passkeys_credential_id_uniq').on(table.credentialId),
    index('passkeys_user_id_idx').on(table.userId),
  ],
)

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: tsCol('expires_at').notNull(),
  },
  (table) => [index('verifications_identifier_idx').on(table.identifier)],
)
