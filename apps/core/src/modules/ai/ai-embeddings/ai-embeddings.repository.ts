import { Inject, Injectable } from '@nestjs/common'
import { and, eq, inArray, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { corpusEmbeddings } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type {
  CorpusEmbeddingRow,
  EmbeddingStats,
  RetrievalResult,
} from './ai-embeddings.types'

const mapRow = (
  row: typeof corpusEmbeddings.$inferSelect,
): CorpusEmbeddingRow => ({
  id: toEntityId(row.id)!,
  sourceType: row.sourceType,
  sourceId: toEntityId(row.sourceId)!,
  chunkIndex: row.chunkIndex,
  content: row.content,
  contentHash: row.contentHash,
  embedding: row.embedding,
  embeddingModel: row.embeddingModel,
  dim: row.dim,
  createdAt: row.createdAt,
})

const vectorLiteral = (vec: number[]) => `[${vec.join(',')}]`

export interface UpsertChunkInput {
  sourceType: string
  sourceId: string
  chunkIndex: number
  content: string
  contentHash: string
  embedding: number[]
  embeddingModel: string
  dim: number
}

@Injectable()
export class AiEmbeddingsRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findBySource(
    sourceType: string,
    sourceId: EntityId | string,
    embeddingModel: string,
  ): Promise<CorpusEmbeddingRow[]> {
    const rows = await this.db
      .select()
      .from(corpusEmbeddings)
      .where(
        and(
          eq(corpusEmbeddings.sourceType, sourceType),
          eq(corpusEmbeddings.sourceId, parseEntityId(sourceId)),
          eq(corpusEmbeddings.embeddingModel, embeddingModel),
        )!,
      )
    return rows.map(mapRow)
  }

  async deleteBySource(
    sourceType: string,
    sourceId: EntityId | string,
  ): Promise<number> {
    const res = await this.db
      .delete(corpusEmbeddings)
      .where(
        and(
          eq(corpusEmbeddings.sourceType, sourceType),
          eq(corpusEmbeddings.sourceId, parseEntityId(sourceId)),
        )!,
      )
      .returning({ id: corpusEmbeddings.id })
    return res.length
  }

  async deleteByIndices(
    sourceType: string,
    sourceId: EntityId | string,
    embeddingModel: string,
    chunkIndices: number[],
  ): Promise<number> {
    if (chunkIndices.length === 0) return 0
    const res = await this.db
      .delete(corpusEmbeddings)
      .where(
        and(
          eq(corpusEmbeddings.sourceType, sourceType),
          eq(corpusEmbeddings.sourceId, parseEntityId(sourceId)),
          eq(corpusEmbeddings.embeddingModel, embeddingModel),
          inArray(corpusEmbeddings.chunkIndex, chunkIndices),
        )!,
      )
      .returning({ id: corpusEmbeddings.id })
    return res.length
  }

  async upsertChunks(inputs: UpsertChunkInput[]): Promise<number> {
    if (inputs.length === 0) return 0
    const rows = inputs.map((input) => ({
      id: this.snowflake.nextId(),
      sourceType: input.sourceType,
      sourceId: parseEntityId(input.sourceId),
      chunkIndex: input.chunkIndex,
      content: input.content,
      contentHash: input.contentHash,
      embedding: input.embedding,
      embeddingModel: input.embeddingModel,
      dim: input.dim,
    }))
    const res = await this.db
      .insert(corpusEmbeddings)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          corpusEmbeddings.sourceType,
          corpusEmbeddings.sourceId,
          corpusEmbeddings.chunkIndex,
          corpusEmbeddings.embeddingModel,
        ],
        set: {
          content: sql`excluded.content`,
          contentHash: sql`excluded.content_hash`,
          embedding: sql`excluded.embedding`,
          dim: sql`excluded.dim`,
        },
      })
      .returning({ id: corpusEmbeddings.id })
    return res.length
  }

  async searchByVector(
    queryVector: number[],
    options: {
      embeddingModel: string
      topK: number
      sourceTypes?: string[]
    },
  ): Promise<RetrievalResult[]> {
    const literal = vectorLiteral(queryVector)
    const filterSourceTypes =
      options.sourceTypes && options.sourceTypes.length > 0
        ? sql`AND ${corpusEmbeddings.sourceType} = ANY(${options.sourceTypes})`
        : sql``

    const rows = await this.db.execute<{
      source_type: string
      source_id: string
      chunk_index: number
      content: string
      distance: number
    }>(sql`
      SELECT
        ${corpusEmbeddings.sourceType} AS source_type,
        ${corpusEmbeddings.sourceId} AS source_id,
        ${corpusEmbeddings.chunkIndex} AS chunk_index,
        ${corpusEmbeddings.content} AS content,
        (${corpusEmbeddings.embedding} <=> ${literal}::vector) AS distance
      FROM ${corpusEmbeddings}
      WHERE ${corpusEmbeddings.embeddingModel} = ${options.embeddingModel}
        ${filterSourceTypes}
      ORDER BY ${corpusEmbeddings.embedding} <=> ${literal}::vector
      LIMIT ${options.topK}
    `)

    const data = Array.isArray(rows) ? rows : (rows.rows ?? [])
    return data.map((row: any) => {
      const distance = Number(row.distance)
      return {
        sourceType: row.source_type,
        sourceId: toEntityId(row.source_id)!,
        chunkIndex: Number(row.chunk_index),
        content: row.content,
        distance,
        similarity: 1 - distance,
      }
    })
  }

  async stats(): Promise<EmbeddingStats> {
    const [totalRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(corpusEmbeddings)
    const total = Number(totalRow?.count ?? 0)

    const byModelRows = await this.db
      .select({
        model: corpusEmbeddings.embeddingModel,
        dim: corpusEmbeddings.dim,
        rows: sql<number>`count(*)::int`,
      })
      .from(corpusEmbeddings)
      .groupBy(corpusEmbeddings.embeddingModel, corpusEmbeddings.dim)

    const bySourceRows = await this.db
      .select({
        type: corpusEmbeddings.sourceType,
        rows: sql<number>`count(*)::int`,
      })
      .from(corpusEmbeddings)
      .groupBy(corpusEmbeddings.sourceType)

    return {
      total,
      byModel: byModelRows.map((r) => ({
        model: r.model,
        dim: Number(r.dim),
        rows: Number(r.rows),
      })),
      bySourceType: bySourceRows.map((r) => ({
        type: r.type,
        rows: Number(r.rows),
      })),
    }
  }
}
