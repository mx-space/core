import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
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

export const aiTranslations = pgTable(
  'ai_translations',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    hash: text('hash').notNull(),
    refId: refBigInt('ref_id').notNull(),
    refType: text('ref_type').notNull(),
    lang: text('lang').notNull(),
    sourceLang: text('source_lang').notNull(),
    title: text('title').notNull(),
    text: text('text').notNull(),
    subtitle: text('subtitle'),
    summary: text('summary'),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    sourceModifiedAt: tsCol('source_modified_at'),
    aiModel: text('ai_model'),
    aiProvider: text('ai_provider'),
    contentFormat: text('content_format'),
    content: text('content'),
    sourceBlockSnapshots: jsonb('source_block_snapshots').$type<unknown>(),
    sourceMetaHashes: jsonb('source_meta_hashes').$type<unknown>(),
  },
  (table) => [
    uniqueIndex('ai_translations_ref_lang_uniq').on(
      table.refId,
      table.refType,
      table.lang,
    ),
    index('ai_translations_ref_id_idx').on(table.refId),
  ],
)

export const translationEntries = pgTable(
  'translation_entries',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    keyPath: text('key_path').notNull(),
    lang: text('lang').notNull(),
    keyType: text('key_type').notNull(),
    lookupKey: text('lookup_key').notNull(),
    sourceText: text('source_text').notNull(),
    translatedText: text('translated_text').notNull(),
    sourceUpdatedAt: tsCol('source_updated_at'),
  },
  (table) => [
    uniqueIndex('translation_entries_key_uniq').on(
      table.keyPath,
      table.lang,
      table.keyType,
      table.lookupKey,
    ),
    index('translation_entries_path_lang_idx').on(table.keyPath, table.lang),
    index('translation_entries_lookup_key_idx').on(table.lookupKey),
  ],
)

export const aiSummaries = pgTable(
  'ai_summaries',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    hash: text('hash').notNull(),
    summary: text('summary').notNull(),
    refId: refBigInt('ref_id').notNull(),
    lang: text('lang'),
  },
  (table) => [index('ai_summaries_ref_id_idx').on(table.refId)],
)

export const aiInsights = pgTable(
  'ai_insights',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    refId: refBigInt('ref_id').notNull(),
    lang: text('lang').notNull(),
    hash: text('hash').notNull(),
    content: text('content').notNull(),
    isTranslation: boolean('is_translation').notNull().default(false),
    sourceInsightsId: refBigInt('source_insights_id').references(
      (): AnyPgColumn => aiInsights.id,
      { onDelete: 'set null' },
    ),
    sourceLang: text('source_lang'),
    modelInfo: jsonb('model_info').$type<Record<string, unknown> | null>(),
  },
  (table) => [
    uniqueIndex('ai_insights_ref_lang_uniq').on(table.refId, table.lang),
  ],
)

export const aiAgentConversations = pgTable(
  'ai_agent_conversations',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    refId: refBigInt('ref_id').notNull(),
    refType: text('ref_type').notNull(),
    title: text('title'),
    messages: jsonb('messages').$type<unknown[]>().notNull(),
    model: text('model').notNull(),
    providerId: text('provider_id').notNull(),
    reviewState: jsonb('review_state').$type<Record<string, unknown> | null>(),
    diffState: jsonb('diff_state').$type<Record<string, unknown> | null>(),
    messageCount: integer('message_count').notNull().default(0),
  },
  (table) => [
    index('ai_agent_conversations_ref_idx').on(table.refId, table.refType),
    index('ai_agent_conversations_updated_at_idx').on(table.updatedAt),
  ],
)

export const searchDocuments = pgTable(
  'search_documents',
  {
    id: pkBigInt(),
    refType: text('ref_type').notNull(),
    refId: refBigInt('ref_id').notNull(),
    title: text('title').notNull(),
    searchText: text('search_text').notNull(),
    terms: text('terms')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    titleTermFreq: jsonb('title_term_freq')
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    bodyTermFreq: jsonb('body_term_freq')
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    titleLength: integer('title_length').notNull().default(0),
    bodyLength: integer('body_length').notNull().default(0),
    slug: text('slug'),
    nid: integer('nid'),
    isPublished: boolean('is_published').notNull().default(true),
    publicAt: tsCol('public_at'),
    hasPassword: boolean('has_password').notNull().default(false),
    createdAt: createdAt(),
    modifiedAt: tsCol('modified_at'),
  },
  (table) => [
    uniqueIndex('search_documents_ref_uniq').on(table.refType, table.refId),
    index('search_documents_published_idx').on(
      table.isPublished,
      table.publicAt,
    ),
  ],
)
