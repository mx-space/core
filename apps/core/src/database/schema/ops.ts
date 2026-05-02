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

import { createdAt, pkBigInt, refBigInt, tsCol, updatedAt } from './columns'

export const options = pgTable(
  'options',
  {
    id: pkBigInt(),
    name: text('name').notNull(),
    value: jsonb('value').$type<unknown>(),
  },
  (table) => [uniqueIndex('options_name_uniq').on(table.name)],
)

export const metaPresets = pgTable(
  'meta_presets',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    name: text('name').notNull(),
    contentType: text('content_type'),
    description: text('description'),
    fields: jsonb('fields')
      .$type<unknown[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (table) => [uniqueIndex('meta_presets_name_uniq').on(table.name)],
)

export const activities = pgTable(
  'activities',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    type: integer('type'),
    payload: jsonb('payload').$type<Record<string, unknown> | null>(),
  },
  (table) => [index('activities_created_at_idx').on(table.createdAt)],
)

export const analyzes = pgTable(
  'analyzes',
  {
    id: pkBigInt(),
    timestamp: tsCol('timestamp').notNull(),
    ip: text('ip'),
    ua: jsonb('ua').$type<Record<string, unknown> | null>(),
    country: text('country'),
    path: text('path'),
    referer: text('referer'),
  },
  (table) => [
    index('analyzes_timestamp_idx').on(table.timestamp),
    index('analyzes_timestamp_path_idx').on(table.timestamp, table.path),
    index('analyzes_timestamp_referer_idx').on(table.timestamp, table.referer),
    index('analyzes_timestamp_ip_idx').on(table.timestamp, table.ip),
  ],
)

export const links = pgTable(
  'links',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    name: text('name').notNull(),
    url: text('url').notNull(),
    avatar: text('avatar'),
    description: text('description'),
    type: integer('type'),
    state: integer('state'),
    email: text('email'),
  },
  (table) => [
    uniqueIndex('links_name_uniq').on(table.name),
    uniqueIndex('links_url_uniq').on(table.url),
  ],
)

export const projects = pgTable(
  'projects',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    name: text('name').notNull(),
    previewUrl: text('preview_url'),
    docUrl: text('doc_url'),
    projectUrl: text('project_url'),
    images: text('images').array(),
    description: text('description').notNull(),
    avatar: text('avatar'),
    text: text('text'),
  },
  (table) => [uniqueIndex('projects_name_uniq').on(table.name)],
)

export const says = pgTable(
  'says',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    text: text('text').notNull(),
    source: text('source'),
    author: text('author'),
  },
  (table) => [index('says_created_at_idx').on(table.createdAt)],
)

export const snippets = pgTable(
  'snippets',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    type: text('type'),
    private: boolean('private').notNull().default(false),
    raw: text('raw').notNull(),
    name: text('name').notNull(),
    reference: text('reference').notNull().default('root'),
    comment: text('comment'),
    metatype: text('metatype'),
    schema: text('schema'),
    method: text('method'),
    customPath: text('custom_path'),
    secret: text('secret'),
    enable: boolean('enable').notNull().default(true),
    builtIn: boolean('built_in').notNull().default(false),
    compiledCode: text('compiled_code'),
  },
  (table) => [
    index('snippets_name_reference_idx').on(table.name, table.reference),
    index('snippets_type_idx').on(table.type),
    uniqueIndex('snippets_custom_path_uniq')
      .on(table.customPath)
      .where(sql`${table.customPath} is not null`),
  ],
)

export const subscribes = pgTable(
  'subscribes',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    email: text('email').notNull(),
    cancelToken: text('cancel_token').notNull(),
    subscribe: integer('subscribe').notNull(),
    verified: boolean('verified').notNull().default(false),
  },
  (table) => [
    uniqueIndex('subscribes_email_uniq').on(table.email),
    uniqueIndex('subscribes_cancel_token_uniq').on(table.cancelToken),
  ],
)

export const fileReferences = pgTable(
  'file_references',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    fileUrl: text('file_url').notNull(),
    fileName: text('file_name').notNull(),
    status: text('status').notNull(),
    refId: refBigInt('ref_id'),
    refType: text('ref_type'),
    s3ObjectKey: text('s3_object_key'),
  },
  (table) => [
    index('file_references_file_url_idx').on(table.fileUrl),
    index('file_references_ref_idx').on(table.refId, table.refType),
    index('file_references_status_created_idx').on(
      table.status,
      table.createdAt,
    ),
  ],
)

export const pollVotes = pgTable(
  'poll_votes',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    pollId: text('poll_id').notNull(),
    voterFingerprint: text('voter_fingerprint').notNull(),
  },
  (table) => [
    uniqueIndex('poll_votes_poll_voter_uniq').on(
      table.pollId,
      table.voterFingerprint,
    ),
    index('poll_votes_poll_id_idx').on(table.pollId),
  ],
)

export const pollVoteOptions = pgTable(
  'poll_vote_options',
  {
    voteId: refBigInt('vote_id')
      .notNull()
      .references(() => pollVotes.id, { onDelete: 'cascade' }),
    optionId: text('option_id').notNull(),
  },
  (table) => [
    uniqueIndex('poll_vote_options_pk').on(table.voteId, table.optionId),
    index('poll_vote_options_option_idx').on(table.optionId),
  ],
)

export const slugTrackers = pgTable(
  'slug_trackers',
  {
    id: pkBigInt(),
    slug: text('slug').notNull(),
    type: text('type').notNull(),
    targetId: refBigInt('target_id').notNull(),
  },
  (table) => [
    index('slug_trackers_type_target_idx').on(table.type, table.targetId),
    index('slug_trackers_slug_type_idx').on(table.slug, table.type),
  ],
)

export const serverlessStorages = pgTable(
  'serverless_storages',
  {
    id: pkBigInt(),
    namespace: text('namespace').notNull(),
    key: text('key').notNull(),
    value: jsonb('value').$type<unknown>().notNull(),
  },
  (table) => [
    uniqueIndex('serverless_storages_ns_key_uniq').on(
      table.namespace,
      table.key,
    ),
  ],
)

export const serverlessLogs = pgTable(
  'serverless_logs',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    functionId: refBigInt('function_id'),
    reference: text('reference').notNull(),
    name: text('name').notNull(),
    method: text('method'),
    ip: text('ip'),
    status: text('status').notNull(),
    executionTime: integer('execution_time').notNull(),
    logs: jsonb('logs').$type<unknown[] | null>(),
    error: jsonb('error').$type<Record<string, unknown> | null>(),
  },
  (table) => [
    index('serverless_logs_created_at_idx').on(table.createdAt),
    index('serverless_logs_function_idx').on(table.functionId, table.createdAt),
    index('serverless_logs_reference_idx').on(
      table.reference,
      table.name,
      table.createdAt,
    ),
  ],
)

export const webhooks = pgTable(
  'webhooks',
  {
    id: pkBigInt(),
    timestamp: tsCol('timestamp'),
    payloadUrl: text('payload_url').notNull(),
    events: text('events').array().notNull(),
    enabled: boolean('enabled').notNull().default(true),
    secret: text('secret').notNull(),
    scope: integer('scope'),
  },
  (table) => [index('webhooks_enabled_idx').on(table.enabled)],
)

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: pkBigInt(),
    timestamp: tsCol('timestamp'),
    headers: jsonb('headers').$type<Record<string, unknown> | null>(),
    payload: jsonb('payload').$type<unknown>(),
    event: text('event'),
    response: jsonb('response').$type<unknown>(),
    success: boolean('success'),
    hookId: refBigInt('hook_id')
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    status: integer('status').notNull().default(0),
  },
  (table) => [
    index('webhook_events_hook_id_idx').on(table.hookId),
    index('webhook_events_timestamp_idx').on(table.timestamp),
  ],
)
