import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { createdAt, pkText, refText, tsCol, updatedAt } from './columns'

export const aiTranslations = pgTable(
  'ai_translations',
  {
    id: pkText(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    hash: text('hash').notNull(),
    refId: refText('ref_id').notNull(),
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
    id: pkText(),
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
    id: pkText(),
    createdAt: createdAt(),
    hash: text('hash').notNull(),
    summary: text('summary').notNull(),
    refId: refText('ref_id').notNull(),
    lang: text('lang'),
    isTranslation: boolean('is_translation').notNull().default(false),
    sourceSummaryId: refText('source_summary_id').references(
      (): AnyPgColumn => aiSummaries.id,
      { onDelete: 'set null' },
    ),
    sourceLang: text('source_lang'),
  },
  (table) => [
    index('ai_summaries_ref_id_idx').on(table.refId),
    uniqueIndex('ai_summaries_ref_lang_uniq').on(table.refId, table.lang),
  ],
)

export const aiInsights = pgTable(
  'ai_insights',
  {
    id: pkText(),
    createdAt: createdAt(),
    refId: refText('ref_id').notNull(),
    lang: text('lang').notNull(),
    hash: text('hash').notNull(),
    content: text('content').notNull(),
    isTranslation: boolean('is_translation').notNull().default(false),
    sourceInsightsId: refText('source_insights_id').references(
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
    id: pkText(),
    sessionId: text('session_id').notNull(),
    model: text('model'),
    providerId: text('provider_id'),
    title: text('title'),
    messages: jsonb('messages')
      .$type<unknown[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('ai_agent_conversation_session_idx').on(table.sessionId)],
)

export const aiTts = pgTable(
  'ai_tts',
  {
    id: pkText(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    refId: refText('ref_id').notNull(),
    lang: text('lang').notNull(),
    isTranslation: boolean('is_translation').notNull().default(false),
    sourceLang: text('source_lang'),
    model: text('model').notNull(),
    voice: text('voice').notNull(),
    speed: real('speed').notNull().default(1),
    format: text('format').notNull().default('mp3'),
    blockOrder: jsonb('block_order')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    charCount: integer('char_count').notNull().default(0),
    totalDurationMs: integer('total_duration_ms'),
    sourceModifiedAt: tsCol('source_modified_at'),
  },
  (table) => [
    uniqueIndex('ai_tts_ref_lang_uniq').on(table.refId, table.lang),
    index('ai_tts_ref_id_idx').on(table.refId),
  ],
)

export const aiTtsBlocks = pgTable(
  'ai_tts_blocks',
  {
    id: pkText(),
    createdAt: createdAt(),
    ttsId: refText('tts_id')
      .notNull()
      .references((): AnyPgColumn => aiTts.id, { onDelete: 'cascade' }),
    blockId: text('block_id').notNull(),
    fingerprint: text('fingerprint').notNull(),
    chunkIndex: integer('chunk_index').notNull().default(0),
    text: text('text').notNull(),
    url: text('url').notNull(),
    storageBackend: text('storage_backend').notNull(),
    storageKey: text('storage_key').notNull(),
    byteSize: integer('byte_size'),
    durationMs: integer('duration_ms'),
  },
  (table) => [
    uniqueIndex('ai_tts_blocks_key_uniq').on(
      table.ttsId,
      table.blockId,
      table.chunkIndex,
    ),
    index('ai_tts_blocks_tts_id_idx').on(table.ttsId),
  ],
)

export const aiGenerationMetrics = pgTable(
  'ai_generation_metrics',
  {
    id: pkText(),
    createdAt: createdAt(),
    resourceType: text('resource_type').notNull(),
    resourceId: refText('resource_id').notNull(),
    refId: refText('ref_id').notNull(),
    lang: text('lang'),
    taskId: text('task_id'),
    providerId: text('provider_id'),
    model: text('model'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cacheReadTokens: integer('cache_read_tokens'),
    cacheWriteTokens: integer('cache_write_tokens'),
    totalTokens: integer('total_tokens'),
    costInputUsd: doublePrecision('cost_input_usd'),
    costOutputUsd: doublePrecision('cost_output_usd'),
    costCacheReadUsd: doublePrecision('cost_cache_read_usd'),
    costCacheWriteUsd: doublePrecision('cost_cache_write_usd'),
    costTotalUsd: doublePrecision('cost_total_usd'),
  },
  (table) => [
    index('ai_generation_metrics_resource_idx').on(
      table.resourceType,
      table.resourceId,
      table.createdAt,
    ),
    index('ai_generation_metrics_ref_id_idx').on(table.refId, table.createdAt),
  ],
)
