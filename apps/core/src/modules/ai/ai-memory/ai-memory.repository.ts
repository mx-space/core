import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, inArray, type SQL, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { aiMemories } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type {
  AiMemory,
  AiMemorySource,
  AiMemoryStatus,
  AiMemoryType,
  RecallScoredMemory,
} from './ai-memory.types'

type AiMemoryRow = typeof aiMemories.$inferSelect

const mapRow = (row: AiMemoryRow): AiMemory => ({
  id: toEntityId(row.id) as EntityId,
  scope: row.scope,
  type: row.type as AiMemoryType,
  content: row.content,
  confidence: row.confidence,
  salience: row.salience,
  source: (row.source ?? {}) as AiMemorySource,
  embedding: row.embedding,
  embeddingModel: row.embeddingModel,
  dim: row.dim,
  firstSeenAt: row.firstSeenAt,
  lastSeenAt: row.lastSeenAt,
  expiresAt: row.expiresAt,
  supersedesId: row.supersedesId
    ? (toEntityId(row.supersedesId) as EntityId)
    : null,
  status: row.status as AiMemoryStatus,
  metadata: (row.metadata ?? {}) as Record<string, unknown>,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

export interface CreateMemoryRow {
  scope: string
  type: AiMemoryType
  content: string
  confidence?: number
  salience?: number
  source?: AiMemorySource
  expiresAt?: Date | null
  metadata?: Record<string, unknown>
}

export interface UpdateMemoryRow {
  scope?: string
  type?: AiMemoryType
  content?: string
  confidence?: number
  salience?: number
  expiresAt?: Date | null
  metadata?: Record<string, unknown>
}

export interface ListMemoryFilters {
  scope?: string
  type?: AiMemoryType
  status?: AiMemoryStatus
}

export interface RecallQueryRow {
  scope: string | string[]
  embedding: number[]
  embeddingModel: string
  limit: number
}

@Injectable()
export class AiMemoryRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findById(id: EntityId | string): Promise<AiMemory | null> {
    const [row] = await this.db
      .select()
      .from(aiMemories)
      .where(eq(aiMemories.id, parseEntityId(id)))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async list(
    filters: ListMemoryFilters,
    page = 1,
    size = 20,
  ): Promise<PaginationResult<AiMemory>> {
    page = Math.max(1, page)
    size = Math.min(100, Math.max(1, size))
    const offset = (page - 1) * size
    const where = this.buildListWhere(filters)
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(aiMemories)
        .where(where)
        .orderBy(desc(aiMemories.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiMemories)
        .where(where),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async create(input: CreateMemoryRow): Promise<AiMemory> {
    const id = this.snowflake.nextId()
    const [row] = await this.db
      .insert(aiMemories)
      .values({
        id,
        scope: input.scope,
        type: input.type,
        content: input.content,
        confidence: input.confidence ?? 1,
        salience: input.salience ?? 1,
        source: input.source ?? {},
        expiresAt: input.expiresAt ?? null,
        metadata: input.metadata ?? {},
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    input: UpdateMemoryRow,
  ): Promise<AiMemory | null> {
    const patch: Partial<typeof aiMemories.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (input.scope !== undefined) patch.scope = input.scope
    if (input.type !== undefined) patch.type = input.type
    if (input.content !== undefined) patch.content = input.content
    if (input.confidence !== undefined) patch.confidence = input.confidence
    if (input.salience !== undefined) patch.salience = input.salience
    if (input.expiresAt !== undefined) patch.expiresAt = input.expiresAt
    if (input.metadata !== undefined) patch.metadata = input.metadata

    const [row] = await this.db
      .update(aiMemories)
      .set(patch)
      .where(eq(aiMemories.id, parseEntityId(id)))
      .returning()
    return row ? mapRow(row) : null
  }

  async updateEmbedding(
    id: EntityId | string,
    embedding: number[],
    embeddingModel: string,
  ): Promise<void> {
    await this.db
      .update(aiMemories)
      .set({
        embedding,
        embeddingModel,
        dim: embedding.length,
        updatedAt: new Date(),
      })
      .where(eq(aiMemories.id, parseEntityId(id)))
  }

  async setStatus(
    id: EntityId | string,
    status: AiMemoryStatus,
  ): Promise<AiMemory | null> {
    const [row] = await this.db
      .update(aiMemories)
      .set({ status, updatedAt: new Date() })
      .where(eq(aiMemories.id, parseEntityId(id)))
      .returning()
    return row ? mapRow(row) : null
  }

  async listActiveByScope(
    scopes: string[],
    limit: number,
  ): Promise<AiMemory[]> {
    if (!scopes.length) return []
    const rows = await this.db
      .select()
      .from(aiMemories)
      .where(
        and(
          eq(aiMemories.status, 'active'),
          inArray(aiMemories.scope, scopes),
          sql`(${aiMemories.expiresAt} is null or ${aiMemories.expiresAt} > now())`,
        )!,
      )
      .orderBy(desc(aiMemories.salience), desc(aiMemories.lastSeenAt))
      .limit(limit)
    return rows.map(mapRow)
  }

  async vectorSearch(
    scopes: string[],
    embedding: number[],
    embeddingModel: string,
    limit: number,
  ): Promise<RecallScoredMemory[]> {
    if (!scopes.length) return []
    const vectorLiteral = `[${embedding.join(',')}]`
    const distance = sql<number>`(${aiMemories.embedding} <=> ${vectorLiteral}::vector)`
    const rows = await this.db
      .select({
        row: aiMemories,
        distance,
      })
      .from(aiMemories)
      .where(
        and(
          eq(aiMemories.status, 'active'),
          inArray(aiMemories.scope, scopes),
          sql`${aiMemories.embedding} is not null`,
          eq(aiMemories.embeddingModel, embeddingModel),
          sql`(${aiMemories.expiresAt} is null or ${aiMemories.expiresAt} > now())`,
        )!,
      )
      .orderBy(distance)
      .limit(limit)

    return rows.map((entry) => {
      const mapped = mapRow(entry.row)
      const dist = Number(entry.distance ?? 1)
      return {
        ...mapped,
        similarity: 1 - dist,
      }
    })
  }

  async countByStatus(): Promise<Record<AiMemoryStatus, number>> {
    const rows = await this.db
      .select({
        status: aiMemories.status,
        count: sql<number>`count(*)::int`,
      })
      .from(aiMemories)
      .groupBy(aiMemories.status)
    const result: Record<string, number> = {}
    for (const r of rows) {
      result[r.status] = Number(r.count ?? 0)
    }
    return {
      active: result.active ?? 0,
      superseded: result.superseded ?? 0,
      archived: result.archived ?? 0,
      pending_review: result.pending_review ?? 0,
    }
  }

  async totalActive(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiMemories)
      .where(eq(aiMemories.status, 'active'))
    return Number(row?.count ?? 0)
  }

  private buildListWhere(filters: ListMemoryFilters): SQL | undefined {
    const conds: SQL[] = []
    if (filters.scope) conds.push(eq(aiMemories.scope, filters.scope))
    if (filters.type) conds.push(eq(aiMemories.type, filters.type))
    if (filters.status) conds.push(eq(aiMemories.status, filters.status))
    if (!conds.length) return undefined
    return and(...conds)
  }
}
