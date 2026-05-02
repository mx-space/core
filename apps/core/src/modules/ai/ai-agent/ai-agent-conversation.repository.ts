import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, type SQL, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { aiAgentConversations } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface AiAgentConversationRow {
  id: EntityId
  refId: EntityId
  refType: string
  title: string | null
  messages: unknown[]
  model: string
  providerId: string
  reviewState: Record<string, unknown> | null
  diffState: Record<string, unknown> | null
  messageCount: number
  createdAt: Date
  updatedAt: Date | null
}

const mapRow = (
  row: typeof aiAgentConversations.$inferSelect,
): AiAgentConversationRow => ({
  id: toEntityId(row.id) as EntityId,
  refId: toEntityId(row.refId) as EntityId,
  refType: row.refType,
  title: row.title,
  messages: row.messages ?? [],
  model: row.model,
  providerId: row.providerId,
  reviewState: row.reviewState,
  diffState: row.diffState,
  messageCount: row.messageCount,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

@Injectable()
export class AiAgentConversationRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findById(
    id: EntityId | string,
  ): Promise<AiAgentConversationRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(aiAgentConversations)
      .where(eq(aiAgentConversations.id, idBig))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async list(
    params: {
      page?: number
      size?: number
      refType?: string
      refId?: EntityId | string
    } = {},
  ): Promise<PaginationResult<AiAgentConversationRow>> {
    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(100, Math.max(1, params.size ?? 20))
    const offset = (page - 1) * size
    const filters: SQL[] = []
    if (params.refType)
      filters.push(eq(aiAgentConversations.refType, params.refType))
    if (params.refId)
      filters.push(eq(aiAgentConversations.refId, parseEntityId(params.refId)))
    const where = filters.length > 0 ? and(...filters) : undefined
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(aiAgentConversations)
        .where(where)
        .orderBy(desc(aiAgentConversations.updatedAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiAgentConversations)
        .where(where),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async create(input: {
    refId: EntityId | string
    refType: string
    title?: string | null
    messages?: unknown[]
    model: string
    providerId: string
    reviewState?: Record<string, unknown> | null
    diffState?: Record<string, unknown> | null
  }): Promise<AiAgentConversationRow> {
    const id = this.snowflake.nextBigInt()
    const messages = input.messages ?? []
    const [row] = await this.db
      .insert(aiAgentConversations)
      .values({
        id,
        refId: parseEntityId(input.refId),
        refType: input.refType,
        title: input.title ?? null,
        messages,
        model: input.model,
        providerId: input.providerId,
        reviewState: input.reviewState ?? null,
        diffState: input.diffState ?? null,
        messageCount: messages.length,
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    patch: Partial<{
      title: string | null
      messages: unknown[]
      model: string
      providerId: string
      reviewState: Record<string, unknown> | null
      diffState: Record<string, unknown> | null
    }>,
  ): Promise<AiAgentConversationRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof aiAgentConversations.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (patch.title !== undefined) update.title = patch.title
    if (patch.messages !== undefined) {
      update.messages = patch.messages
      update.messageCount = patch.messages.length
    }
    if (patch.model !== undefined) update.model = patch.model
    if (patch.providerId !== undefined) update.providerId = patch.providerId
    if (patch.reviewState !== undefined) update.reviewState = patch.reviewState
    if (patch.diffState !== undefined) update.diffState = patch.diffState
    const [row] = await this.db
      .update(aiAgentConversations)
      .set(update)
      .where(eq(aiAgentConversations.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async appendMessage(
    id: EntityId | string,
    message: unknown,
  ): Promise<AiAgentConversationRow | null> {
    const idBig = parseEntityId(id)
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(aiAgentConversations)
        .where(eq(aiAgentConversations.id, idBig))
        .limit(1)
      if (!existing) return null
      const messages = ((existing.messages as unknown[] | null) ?? []).concat(
        message,
      )
      const [row] = await tx
        .update(aiAgentConversations)
        .set({
          messages,
          messageCount: messages.length,
          updatedAt: new Date(),
        })
        .where(eq(aiAgentConversations.id, idBig))
        .returning()
      return row ? mapRow(row) : null
    })
  }

  async deleteById(
    id: EntityId | string,
  ): Promise<AiAgentConversationRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(aiAgentConversations)
      .where(eq(aiAgentConversations.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }
}
