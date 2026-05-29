import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { createdAt, pkText, refText, tsCol, updatedAt, vector } from './columns'

export const aiTranslations = pgTable(
  'ai_translations',
  {
    id: pkText(),
    createdAt: createdAt(),
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
  },
  (table) => [index('ai_summaries_ref_id_idx').on(table.refId)],
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    refId: refText('ref_id').notNull(),
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

export const corpusEmbeddings = pgTable(
  'corpus_embeddings',
  {
    id: pkText(),
    sourceType: text('source_type').notNull(),
    sourceId: refText('source_id').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    embedding: vector('embedding').notNull(),
    embeddingModel: text('embedding_model').notNull(),
    dim: integer('dim').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('corpus_embeddings_source_chunk_model_uniq').on(
      table.sourceType,
      table.sourceId,
      table.chunkIndex,
      table.embeddingModel,
    ),
    index('corpus_embeddings_source_idx').on(table.sourceType, table.sourceId),
  ],
)

export const personaProfiles = pgTable('persona_profiles', {
  id: pkText(),
  personaKey: text('persona_key').notNull().unique(),
  profile: text('profile').notNull(),
  profileSummary: text('profile_summary'),
  corpusVersion: integer('corpus_version').notNull(),
  distillModel: text('distill_model').notNull(),
  refreshedAt: tsCol('refreshed_at').notNull(),
  autoNextAt: tsCol('auto_next_at'),
  metadata: jsonb('metadata')
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const aiMemories = pgTable(
  'ai_memories',
  {
    id: pkText(),
    scope: text('scope').notNull(),
    type: text('type').notNull(),
    content: text('content').notNull(),
    confidence: real('confidence').notNull().default(1),
    salience: real('salience').notNull().default(1),
    source: jsonb('source')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    embedding: vector('embedding'),
    embeddingModel: text('embedding_model'),
    dim: integer('dim'),
    firstSeenAt: tsCol('first_seen_at').notNull().defaultNow(),
    lastSeenAt: tsCol('last_seen_at').notNull().defaultNow(),
    expiresAt: tsCol('expires_at'),
    supersedesId: refText('supersedes_id').references(
      (): AnyPgColumn => aiMemories.id,
      { onDelete: 'set null' },
    ),
    status: text('status').notNull().default('active'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('ai_memories_scope_status_idx').on(table.scope, table.status),
    index('ai_memories_active_idx')
      .on(table.status)
      .where(sql`${table.status} = 'active'`),
  ],
)

export const aiEchoes = pgTable(
  'ai_echoes',
  {
    id: pkText(),
    scenarioKey: text('scenario_key').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: refText('subject_id').notNull(),
    personaKey: text('persona_key').notNull(),
    content: text('content'),
    status: text('status').notNull(),
    model: text('model'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    generatedAt: tsCol('generated_at'),
    editedAt: tsCol('edited_at'),
    editedBy: refText('edited_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('ai_echoes_subject_idx').on(
      table.scenarioKey,
      table.subjectType,
      table.subjectId,
    ),
    index('ai_echoes_status_idx').on(table.scenarioKey, table.status),
    index('ai_echoes_persona_subject_idx').on(
      table.subjectType,
      table.subjectId,
      table.personaKey,
    ),
  ],
)
