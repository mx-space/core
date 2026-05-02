import { Inject, Injectable } from '@nestjs/common'
import { desc, eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { activities } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface ActivityRow {
  id: EntityId
  type: number | null
  payload: Record<string, unknown> | null
  createdAt: Date
}

const mapRow = (row: typeof activities.$inferSelect): ActivityRow => ({
  id: toEntityId(row.id) as EntityId,
  type: row.type,
  payload: row.payload,
  createdAt: row.createdAt,
})

@Injectable()
export class ActivityRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async list(page = 1, size = 10): Promise<PaginationResult<ActivityRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(activities)
        .orderBy(desc(activities.createdAt))
        .limit(size)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(activities),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async create(input: {
    type?: number
    payload?: Record<string, unknown> | null
  }): Promise<ActivityRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(activities)
      .values({
        id,
        type: input.type ?? null,
        payload: input.payload ?? null,
      })
      .returning()
    return mapRow(row)
  }

  async findById(id: EntityId | string): Promise<ActivityRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(activities)
      .where(eq(activities.id, idBig))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async deleteById(id: EntityId | string): Promise<ActivityRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(activities)
      .where(eq(activities.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteOlderThan(threshold: Date): Promise<number> {
    const result = await this.db
      .delete(activities)
      .where(sql`${activities.createdAt} < ${threshold}`)
      .returning({ id: activities.id })
    return result.length
  }
}
