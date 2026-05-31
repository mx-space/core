import { Inject, Injectable } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { aiAgentConversations } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type { AiAgentConversationRow } from './ai-agent-conversation.types'

const mapRow = (
  row: typeof aiAgentConversations.$inferSelect,
): AiAgentConversationRow => ({
  id: toEntityId(row.id) as EntityId,
  sessionId: row.sessionId,
  model: row.model,
  providerId: row.providerId,
  title: row.title,
  messages: (row.messages as unknown[] | null) ?? [],
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

  async listBySession(sessionId: string): Promise<AiAgentConversationRow[]> {
    const rows = await this.db
      .select()
      .from(aiAgentConversations)
      .where(eq(aiAgentConversations.sessionId, sessionId))
      .orderBy(desc(aiAgentConversations.updatedAt))
    return rows.map(mapRow)
  }

  async create(input: {
    sessionId: string
    messages?: unknown[]
    model?: string | null
    providerId?: string | null
  }): Promise<AiAgentConversationRow> {
    const id = this.snowflake.nextId()
    const messages = input.messages ?? []
    const now = new Date()
    const [row] = await this.db
      .insert(aiAgentConversations)
      .values({
        id,
        sessionId: input.sessionId,
        messages,
        model: input.model ?? null,
        providerId: input.providerId ?? null,
        updatedAt: now,
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    patch: Partial<{
      sessionId: string
      messages: unknown[]
      model: string | null
      providerId: string | null
      title: string | null
    }>,
  ): Promise<AiAgentConversationRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof aiAgentConversations.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (patch.sessionId !== undefined) update.sessionId = patch.sessionId
    if (patch.messages !== undefined) update.messages = patch.messages
    if (patch.model !== undefined) update.model = patch.model
    if (patch.providerId !== undefined) update.providerId = patch.providerId
    if (patch.title !== undefined) update.title = patch.title
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
