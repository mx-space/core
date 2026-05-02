import { Inject, Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'
import slugify from 'slugify'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { topics } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface TopicRow {
  id: EntityId
  name: string
  slug: string
  description: string
  introduce: string | null
  icon: string | null
  createdAt: Date
}

export interface TopicCreateInput {
  name: string
  slug?: string
  description?: string
  introduce?: string | null
  icon?: string | null
}

export type TopicPatchInput = Partial<TopicCreateInput>

const mapRow = (row: typeof topics.$inferSelect): TopicRow => ({
  id: toEntityId(row.id) as EntityId,
  name: row.name,
  slug: row.slug,
  description: row.description,
  introduce: row.introduce,
  icon: row.icon,
  createdAt: row.createdAt,
})

@Injectable()
export class TopicRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findAll(): Promise<TopicRow[]> {
    const rows = await this.db.select().from(topics).orderBy(topics.createdAt)
    return rows.map(mapRow)
  }

  async findById(id: EntityId | string): Promise<TopicRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(topics)
      .where(eq(topics.id, idBig))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findBySlug(slug: string): Promise<TopicRow | null> {
    const [row] = await this.db
      .select()
      .from(topics)
      .where(eq(topics.slug, slug))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByName(name: string): Promise<TopicRow | null> {
    const [row] = await this.db
      .select()
      .from(topics)
      .where(eq(topics.name, name))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async create(input: TopicCreateInput): Promise<TopicRow> {
    const id = this.snowflake.nextBigInt()
    const slug = input.slug ?? slugify(input.name)
    const [row] = await this.db
      .insert(topics)
      .values({
        id,
        name: input.name,
        slug,
        description: input.description ?? '',
        introduce: input.introduce ?? null,
        icon: input.icon ?? null,
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    patch: TopicPatchInput,
  ): Promise<TopicRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof topics.$inferInsert> = {}
    if (patch.name !== undefined) update.name = patch.name
    if (patch.slug !== undefined) update.slug = slugify(patch.slug)
    if (patch.description !== undefined) update.description = patch.description
    if (patch.introduce !== undefined) update.introduce = patch.introduce
    if (patch.icon !== undefined) update.icon = patch.icon
    if (Object.keys(update).length === 0) return this.findById(id)
    const [row] = await this.db
      .update(topics)
      .set(update)
      .where(eq(topics.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteById(id: EntityId | string): Promise<TopicRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(topics)
      .where(eq(topics.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(topics)
    return Number(row?.count ?? 0)
  }
}
