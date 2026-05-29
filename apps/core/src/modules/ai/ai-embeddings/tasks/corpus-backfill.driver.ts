import { asc, gt } from 'drizzle-orm'

import { notes, pages, posts } from '~/database/schema'
import type { AppDatabase } from '~/processors/database/postgres.provider'

import {
  EMBEDDINGS_DEFAULTS,
  SUPPORTED_SOURCE_TYPES,
  type SupportedSourceType,
} from '../ai-embeddings.constants'
import type { AiEmbeddingsService } from '../ai-embeddings.service'

export interface BackfillOptions {
  sourceTypes?: readonly string[]
  batchSize?: number
}

export interface BackfillSummary {
  configured: boolean
  sourceTypes: string[]
  scanned: number
  embedded: number
  deleted: number
  skipped: number
}

const sourceTables = {
  post: posts,
  note: notes,
  page: pages,
} as const

export async function listSourceIdsAfter(
  db: AppDatabase,
  sourceType: SupportedSourceType,
  cursor: string | null,
  limit: number,
): Promise<string[]> {
  const table = sourceTables[sourceType]
  const condition = cursor ? gt(table.id, cursor) : undefined
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(condition)
    .orderBy(asc(table.id))
    .limit(limit)
  return rows.map((r) => String(r.id))
}

export async function runCorpusBackfill(
  service: AiEmbeddingsService,
  db: AppDatabase,
  options: BackfillOptions = {},
): Promise<BackfillSummary> {
  const configured = await service.isEmbeddingConfigured()
  const sourceTypes = (
    options.sourceTypes && options.sourceTypes.length > 0
      ? options.sourceTypes
      : SUPPORTED_SOURCE_TYPES
  ).filter((t): t is SupportedSourceType =>
    (SUPPORTED_SOURCE_TYPES as readonly string[]).includes(t),
  )

  const summary: BackfillSummary = {
    configured,
    sourceTypes: [...sourceTypes],
    scanned: 0,
    embedded: 0,
    deleted: 0,
    skipped: 0,
  }

  if (!configured || sourceTypes.length === 0) {
    return summary
  }

  const params = await service.resolveParams()
  const batchSize =
    options.batchSize ??
    params.backfillBatchSize ??
    EMBEDDINGS_DEFAULTS.backfillBatchSize

  for (const sourceType of sourceTypes) {
    let cursor: string | null = null
    while (true) {
      const batch = await listSourceIdsAfter(db, sourceType, cursor, batchSize)
      if (batch.length === 0) break
      for (const id of batch) {
        try {
          const result = await service.syncSource(sourceType, id, 'upsert')
          summary.scanned++
          summary.embedded += result.embedded ?? 0
          summary.deleted += result.deleted ?? 0
        } catch {
          summary.skipped++
        }
      }
      cursor = batch.at(-1) ?? null
      if (batch.length < batchSize) break
    }
  }

  return summary
}
