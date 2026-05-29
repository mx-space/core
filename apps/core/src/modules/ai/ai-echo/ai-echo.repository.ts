import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, type SQL, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { aiEchoes } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type {
  AiEcho,
  AiEchoCreateInput,
  AiEchoListFilters,
  AiEchoMetadata,
  AiEchoStatus,
  AiEchoUpdateInput,
} from './ai-echo.types'

type AiEchoRow = typeof aiEchoes.$inferSelect

const mapRow = (row: AiEchoRow): AiEcho => ({
  id: toEntityId(row.id) as EntityId,
  scenarioKey: row.scenarioKey,
  subjectType: row.subjectType,
  subjectId: toEntityId(row.subjectId) as EntityId,
  personaKey: row.personaKey,
  content: row.content,
  status: row.status as AiEchoStatus,
  model: row.model,
  metadata: (row.metadata ?? {}) as AiEchoMetadata,
  generatedAt: row.generatedAt,
  editedAt: row.editedAt,
  editedBy: row.editedBy ? (toEntityId(row.editedBy) as EntityId) : null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

@Injectable()
export class AiEchoRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findById(id: EntityId | string): Promise<AiEcho | null> {
    const [row] = await this.db
      .select()
      .from(aiEchoes)
      .where(eq(aiEchoes.id, parseEntityId(id)))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findOne(criteria: {
    scenarioKey: string
    subjectType: string
    subjectId: string
    personaKey: string
  }): Promise<AiEcho | null> {
    const [row] = await this.db
      .select()
      .from(aiEchoes)
      .where(
        and(
          eq(aiEchoes.scenarioKey, criteria.scenarioKey),
          eq(aiEchoes.subjectType, criteria.subjectType),
          eq(aiEchoes.subjectId, parseEntityId(criteria.subjectId)),
          eq(aiEchoes.personaKey, criteria.personaKey),
        )!,
      )
      .orderBy(desc(aiEchoes.createdAt))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findAllBySubject(
    scenarioKey: string,
    subjectType: string,
    subjectId: EntityId | string,
  ): Promise<AiEcho[]> {
    const rows = await this.db
      .select()
      .from(aiEchoes)
      .where(
        and(
          eq(aiEchoes.scenarioKey, scenarioKey),
          eq(aiEchoes.subjectType, subjectType),
          eq(aiEchoes.subjectId, parseEntityId(subjectId)),
        )!,
      )
      .orderBy(desc(aiEchoes.createdAt))
    return rows.map(mapRow)
  }

  async findAdmin(
    filters: AiEchoListFilters,
    page = 1,
    size = 20,
  ): Promise<PaginationResult<AiEcho>> {
    page = Math.max(1, page)
    size = Math.min(100, Math.max(1, size))
    const offset = (page - 1) * size
    const where = this.buildListWhere(filters)
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(aiEchoes)
        .where(where)
        .orderBy(desc(aiEchoes.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiEchoes)
        .where(where),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async create(input: AiEchoCreateInput): Promise<AiEcho> {
    const id = this.snowflake.nextId()
    const [row] = await this.db
      .insert(aiEchoes)
      .values({
        id,
        scenarioKey: input.scenarioKey,
        subjectType: input.subjectType,
        subjectId: parseEntityId(input.subjectId),
        personaKey: input.personaKey,
        status: input.status,
        metadata: input.metadata ?? {},
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    patch: AiEchoUpdateInput,
  ): Promise<AiEcho | null> {
    const update: Partial<typeof aiEchoes.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (patch.status !== undefined) update.status = patch.status
    if (patch.content !== undefined) update.content = patch.content
    if (patch.model !== undefined) update.model = patch.model
    if (patch.metadata !== undefined) update.metadata = patch.metadata
    if (patch.generatedAt !== undefined) update.generatedAt = patch.generatedAt
    if (patch.editedAt !== undefined) update.editedAt = patch.editedAt
    if (patch.editedBy !== undefined) {
      update.editedBy = patch.editedBy ? parseEntityId(patch.editedBy) : null
    }

    const [row] = await this.db
      .update(aiEchoes)
      .set(update)
      .where(eq(aiEchoes.id, parseEntityId(id)))
      .returning()
    return row ? mapRow(row) : null
  }

  async setStatus(
    id: EntityId | string,
    status: AiEchoStatus,
    metadataPatch?: AiEchoMetadata,
  ): Promise<AiEcho | null> {
    const existing = await this.findById(id)
    if (!existing) return null
    const nextMetadata = metadataPatch
      ? { ...existing.metadata, ...metadataPatch }
      : existing.metadata
    return this.update(id, { status, metadata: nextMetadata })
  }

  private buildListWhere(filters: AiEchoListFilters): SQL | undefined {
    const conds: SQL[] = []
    if (filters.scenarioKey)
      conds.push(eq(aiEchoes.scenarioKey, filters.scenarioKey))
    if (filters.status) conds.push(eq(aiEchoes.status, filters.status))
    if (filters.personaKey)
      conds.push(eq(aiEchoes.personaKey, filters.personaKey))
    if (filters.subjectType)
      conds.push(eq(aiEchoes.subjectType, filters.subjectType))
    if (!conds.length) return undefined
    return and(...conds)
  }
}
