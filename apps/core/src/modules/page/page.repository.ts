import { Inject, Injectable } from '@nestjs/common'
import { asc, eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { pages } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface PageRow {
  id: EntityId
  title: string
  slug: string
  subtitle: string | null
  text: string | null
  content: string | null
  contentFormat: string
  images: unknown[] | null
  meta: Record<string, unknown> | null
  order: number
  createdAt: Date
  modifiedAt: Date | null
}

export interface PageCreateInput {
  title: string
  slug: string
  subtitle?: string | null
  text?: string | null
  content?: string | null
  contentFormat: string
  images?: unknown[] | null
  meta?: Record<string, unknown> | null
  order?: number
}

export type PagePatchInput = Partial<PageCreateInput>

const mapRow = (row: typeof pages.$inferSelect): PageRow => ({
  id: toEntityId(row.id) as EntityId,
  title: row.title,
  slug: row.slug,
  subtitle: row.subtitle,
  text: row.text,
  content: row.content,
  contentFormat: row.contentFormat,
  images: row.images,
  meta: row.meta,
  order: row.order,
  createdAt: row.createdAt,
  modifiedAt: row.modifiedAt,
})

@Injectable()
export class PageRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findAll(): Promise<PageRow[]> {
    const rows = await this.db
      .select()
      .from(pages)
      .orderBy(asc(pages.order), asc(pages.createdAt))
    return rows.map(mapRow)
  }

  async findById(id: EntityId | string): Promise<PageRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(pages)
      .where(eq(pages.id, idBig))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findBySlug(slug: string): Promise<PageRow | null> {
    const [row] = await this.db
      .select()
      .from(pages)
      .where(eq(pages.slug, slug))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async create(input: PageCreateInput): Promise<PageRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(pages)
      .values({
        id,
        title: input.title,
        slug: input.slug,
        subtitle: input.subtitle ?? null,
        text: input.text ?? null,
        content: input.content ?? null,
        contentFormat: input.contentFormat,
        images: input.images ?? null,
        meta: input.meta ?? null,
        order: input.order ?? 1,
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    patch: PagePatchInput,
  ): Promise<PageRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof pages.$inferInsert> = {
      modifiedAt: new Date(),
    }
    if (patch.title !== undefined) update.title = patch.title
    if (patch.slug !== undefined) update.slug = patch.slug
    if (patch.subtitle !== undefined) update.subtitle = patch.subtitle
    if (patch.text !== undefined) update.text = patch.text
    if (patch.content !== undefined) update.content = patch.content
    if (patch.contentFormat !== undefined)
      update.contentFormat = patch.contentFormat
    if (patch.images !== undefined) update.images = patch.images
    if (patch.meta !== undefined) update.meta = patch.meta
    if (patch.order !== undefined) update.order = patch.order
    const [row] = await this.db
      .update(pages)
      .set(update)
      .where(eq(pages.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteById(id: EntityId | string): Promise<PageRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(pages)
      .where(eq(pages.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(pages)
    return Number(row?.count ?? 0)
  }
}
