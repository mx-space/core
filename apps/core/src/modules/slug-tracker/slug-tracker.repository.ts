import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { slugTrackers } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface SlugTrackerRow {
  id: EntityId
  slug: string
  type: string
  targetId: EntityId
}

const mapRow = (row: typeof slugTrackers.$inferSelect): SlugTrackerRow => ({
  id: toEntityId(row.id) as EntityId,
  slug: row.slug,
  type: row.type,
  targetId: toEntityId(row.targetId) as EntityId,
})

@Injectable()
export class SlugTrackerRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  /**
   * Idempotent insert. The legacy Mongo implementation used upsert against
   * `(slug, type, targetId)`; PG does the same via ON CONFLICT DO NOTHING.
   */
  async createTracker(
    slug: string,
    type: string,
    targetId: EntityId | string,
  ): Promise<void> {
    const id = this.snowflake.nextBigInt()
    await this.db
      .insert(slugTrackers)
      .values({
        id,
        slug,
        type,
        targetId: parseEntityId(targetId),
      })
      .onConflictDoNothing()
  }

  async findBySlug(slug: string, type: string): Promise<SlugTrackerRow | null> {
    const [row] = await this.db
      .select()
      .from(slugTrackers)
      .where(and(eq(slugTrackers.slug, slug), eq(slugTrackers.type, type))!)
      .limit(1)
    return row ? mapRow(row) : null
  }

  async deleteAllForTarget(
    type: string,
    targetId: EntityId | string,
  ): Promise<number> {
    const result = await this.db
      .delete(slugTrackers)
      .where(
        and(
          eq(slugTrackers.type, type),
          eq(slugTrackers.targetId, parseEntityId(targetId)),
        )!,
      )
      .returning({ id: slugTrackers.id })
    return result.length
  }

  async deleteAllForTargetId(targetId: EntityId | string): Promise<number> {
    const result = await this.db
      .delete(slugTrackers)
      .where(eq(slugTrackers.targetId, parseEntityId(targetId)))
      .returning({ id: slugTrackers.id })
    return result.length
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(slugTrackers)
    return Number(row?.count ?? 0)
  }
}
