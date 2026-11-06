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

import type {
  AiAgentConversationDetailRow,
  AiAgentConversationRow,
} from './ai-agent-conversation.types'

type MetaRow = Pick<
  typeof aiAgentConversations.$inferSelect,
  | 'id'
  | 'sessionId'
  | 'model'
  | 'providerId'
  | 'title'
  | 'createdAt'
  | 'updatedAt'
>

const mapRow = (row: MetaRow): AiAgentConversationRow => ({
  id: toEntityId(row.id) as EntityId,
  sessionId: row.sessionId,
  model: row.model,
  providerId: row.providerId,
  title: row.title,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

const metaColumns = {
  id: aiAgentConversations.id,
  sessionId: aiAgentConversations.sessionId,
  model: aiAgentConversations.model,
  providerId: aiAgentConversations.providerId,
  title: aiAgentConversations.title,
  createdAt: aiAgentConversations.createdAt,
  updatedAt: aiAgentConversations.updatedAt,
}

const EMPTY_TRANSCRIPT = { messages: [], known: {} }

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
      .select(metaColumns)
      .from(aiAgentConversations)
      .where(eq(aiAgentConversations.id, idBig))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findDetail(
    id: EntityId | string,
  ): Promise<AiAgentConversationDetailRow | null> {
    const [row] = await this.db
      .select()
      .from(aiAgentConversations)
      .where(eq(aiAgentConversations.id, parseEntityId(id)))
      .limit(1)
    if (!row) return null
    return {
      ...mapRow(row),
      transcript: row.transcript,
      reviewState: row.reviewState ?? null,
    }
  }

  async listBySession(sessionId: string): Promise<AiAgentConversationRow[]> {
    const rows = await this.db
      .select(metaColumns)
      .from(aiAgentConversations)
      .where(eq(aiAgentConversations.sessionId, sessionId))
      .orderBy(desc(aiAgentConversations.updatedAt))
    return rows.map(mapRow)
  }

  async create(input: {
    sessionId: string
    model: string
    providerId: string
  }): Promise<AiAgentConversationRow> {
    const [row] = await this.db
      .insert(aiAgentConversations)
      .values({
        id: this.snowflake.nextId(),
        sessionId: input.sessionId,
        model: input.model,
        providerId: input.providerId,
        transcript: EMPTY_TRANSCRIPT,
        updatedAt: new Date(),
      })
      .returning(metaColumns)
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    patch: Partial<{
      sessionId: string
      model: string
      providerId: string
      title: string | null
    }>,
  ): Promise<AiAgentConversationRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof aiAgentConversations.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (patch.sessionId !== undefined) update.sessionId = patch.sessionId
    if (patch.model !== undefined) update.model = patch.model
    if (patch.providerId !== undefined) update.providerId = patch.providerId
    if (patch.title !== undefined) update.title = patch.title
    const [row] = await this.db
      .update(aiAgentConversations)
      .set(update)
      .where(eq(aiAgentConversations.id, idBig))
      .returning(metaColumns)
    return row ? mapRow(row) : null
  }

  async findWithTranscript(
    id: EntityId | string,
  ): Promise<{ transcript: Record<string, unknown> } | null> {
    const [row] = await this.db
      .select({ transcript: aiAgentConversations.transcript })
      .from(aiAgentConversations)
      .where(eq(aiAgentConversations.id, parseEntityId(id)))
      .limit(1)
    return row ?? null
  }

  async saveTranscript(
    id: EntityId | string,
    transcript: Record<string, unknown>,
  ): Promise<void> {
    await this.db
      .update(aiAgentConversations)
      .set({ transcript, updatedAt: new Date() })
      .where(eq(aiAgentConversations.id, parseEntityId(id)))
  }

  async saveReviewState(
    id: EntityId | string,
    reviewState: Record<string, unknown>,
  ): Promise<boolean> {
    const rows = await this.db
      .update(aiAgentConversations)
      .set({ reviewState, updatedAt: new Date() })
      .where(eq(aiAgentConversations.id, parseEntityId(id)))
      .returning({ id: aiAgentConversations.id })
    return rows.length > 0
  }

  async deleteById(
    id: EntityId | string,
  ): Promise<AiAgentConversationRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(aiAgentConversations)
      .where(eq(aiAgentConversations.id, idBig))
      .returning(metaColumns)
    return row ? mapRow(row) : null
  }
}
