import { Inject, Injectable } from '@nestjs/common'
import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  lt,
  lte,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { notes, topics } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface NoteRow {
  id: EntityId
  nid: number
  title: string
  slug: string | null
  text: string
  content: string | null
  contentFormat: string
  images: unknown[] | null
  meta: Record<string, unknown> | null
  isPublished: boolean
  hasPassword: boolean
  publicAt: Date | null
  mood: string | null
  weather: string | null
  bookmark: boolean
  coordinates: { latitude: number; longitude: number } | null
  location: string | null
  readCount: number
  likeCount: number
  topicId: EntityId | null
  topic?: { id: EntityId; name: string; slug: string } | null
  createdAt: Date
  modifiedAt: Date | null
}

export interface NoteCreateInput {
  nid: number
  contentFormat: string
  title?: string | null
  slug?: string | null
  text?: string | null
  content?: string | null
  images?: unknown[] | null
  meta?: Record<string, unknown> | null
  isPublished?: boolean
  password?: string | null
  publicAt?: Date | null
  createdAt?: Date
  mood?: string | null
  weather?: string | null
  bookmark?: boolean
  coordinates?: { latitude: number; longitude: number } | null
  location?: string | null
  topicId?: EntityId | string | null
}

export type NotePatchInput = Partial<NoteCreateInput> & {
  modifiedAt?: Date | null
}

const mapBase = (row: typeof notes.$inferSelect): NoteRow => ({
  id: toEntityId(row.id) as EntityId,
  nid: row.nid,
  title: row.title ?? '',
  slug: row.slug,
  text: row.text ?? '',
  content: row.content,
  contentFormat: row.contentFormat,
  images: row.images,
  meta: row.meta,
  isPublished: row.isPublished,
  hasPassword: row.password !== null,
  publicAt: row.publicAt,
  mood: row.mood,
  weather: row.weather,
  bookmark: row.bookmark,
  coordinates: row.coordinates as NoteRow['coordinates'],
  location: row.location,
  readCount: row.readCount,
  likeCount: row.likeCount,
  topicId: row.topicId ? (toEntityId(row.topicId) as EntityId) : null,
  createdAt: row.createdAt,
  modifiedAt: row.modifiedAt,
})

@Injectable()
export class NoteRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async nextNid(): Promise<number> {
    const [row] = await this.db
      .select({ max: sql<number>`coalesce(max(${notes.nid}), 0)::int` })
      .from(notes)
    return Number(row?.max ?? 0) + 1
  }

  async getPassword(id: EntityId | string): Promise<string | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select({ password: notes.password })
      .from(notes)
      .where(eq(notes.id, idBig))
      .limit(1)
    return row?.password ?? null
  }

  async findById(id: EntityId | string): Promise<NoteRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(notes)
      .where(eq(notes.id, idBig))
      .limit(1)
    if (!row) return null
    return this.attachTopic(mapBase(row))
  }

  async findByNid(nid: number): Promise<NoteRow | null> {
    const [row] = await this.db
      .select()
      .from(notes)
      .where(eq(notes.nid, nid))
      .limit(1)
    if (!row) return null
    return this.attachTopic(mapBase(row))
  }

  async findBySlug(slug: string): Promise<NoteRow | null> {
    const [row] = await this.db
      .select()
      .from(notes)
      .where(eq(notes.slug, slug))
      .limit(1)
    if (!row) return null
    return this.attachTopic(mapBase(row))
  }

  /**
   * Visibility predicate matching service behavior: only published notes
   * whose `publicAt` (if set) is in the past.
   */
  private visibleClause(): SQL {
    return and(
      eq(notes.isPublished, true),
      or(sql`${notes.publicAt} is null`, lte(notes.publicAt, new Date()))!,
    )!
  }

  async listVisible(page = 1, size = 10): Promise<PaginationResult<NoteRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const where = this.visibleClause()
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(notes)
        .where(where)
        .orderBy(desc(notes.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(notes)
        .where(where),
    ])
    const data = await Promise.all(
      rows.map((r) => this.attachTopic(mapBase(r))),
    )
    return {
      data,
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async create(input: NoteCreateInput): Promise<NoteRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(notes)
      .values({
        id,
        nid: input.nid,
        title: input.title ?? null,
        slug: input.slug ?? null,
        text: input.text ?? null,
        content: input.content ?? null,
        contentFormat: input.contentFormat,
        images: input.images ?? null,
        meta: input.meta ?? null,
        isPublished: input.isPublished ?? true,
        password: input.password ?? null,
        publicAt: input.publicAt ?? null,
        mood: input.mood ?? null,
        weather: input.weather ?? null,
        bookmark: input.bookmark ?? false,
        coordinates: input.coordinates ?? null,
        location: input.location ?? null,
        topicId: input.topicId ? parseEntityId(input.topicId) : null,
      })
      .returning()
    return this.attachTopic(mapBase(row))
  }

  async update(
    id: EntityId | string,
    patch: NotePatchInput,
  ): Promise<NoteRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof notes.$inferInsert> = {
      modifiedAt: patch.modifiedAt ?? new Date(),
    }
    if (patch.title !== undefined) update.title = patch.title
    if (patch.slug !== undefined) update.slug = patch.slug
    if (patch.text !== undefined) update.text = patch.text
    if (patch.content !== undefined) update.content = patch.content
    if (patch.contentFormat !== undefined)
      update.contentFormat = patch.contentFormat
    if (patch.images !== undefined) update.images = patch.images
    if (patch.meta !== undefined) update.meta = patch.meta
    if (patch.isPublished !== undefined) update.isPublished = patch.isPublished
    if (patch.password !== undefined) update.password = patch.password
    if (patch.publicAt !== undefined) update.publicAt = patch.publicAt
    if (patch.createdAt !== undefined) update.createdAt = patch.createdAt
    if (patch.mood !== undefined) update.mood = patch.mood
    if (patch.weather !== undefined) update.weather = patch.weather
    if (patch.bookmark !== undefined) update.bookmark = patch.bookmark
    if (patch.coordinates !== undefined) update.coordinates = patch.coordinates
    if (patch.location !== undefined) update.location = patch.location
    if (patch.topicId !== undefined)
      update.topicId = patch.topicId ? parseEntityId(patch.topicId) : null
    const [row] = await this.db
      .update(notes)
      .set(update)
      .where(eq(notes.id, idBig))
      .returning()
    return row ? this.attachTopic(mapBase(row)) : null
  }

  async deleteById(id: EntityId | string): Promise<NoteRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(notes)
      .where(eq(notes.id, idBig))
      .returning()
    return row ? mapBase(row) : null
  }

  async incrementRead(id: EntityId | string, by = 1): Promise<void> {
    const idBig = parseEntityId(id)
    await this.db
      .update(notes)
      .set({ readCount: sql`${notes.readCount} + ${by}` })
      .where(eq(notes.id, idBig))
  }

  async incrementLike(id: EntityId | string, by = 1): Promise<void> {
    const idBig = parseEntityId(id)
    await this.db
      .update(notes)
      .set({ likeCount: sql`${notes.likeCount} + ${by}` })
      .where(eq(notes.id, idBig))
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notes)
    return Number(row?.count ?? 0)
  }

  async countVisible(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notes)
      .where(this.visibleClause())
    return Number(row?.count ?? 0)
  }

  async listAll(page = 1, size = 10): Promise<PaginationResult<NoteRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(notes)
        .orderBy(desc(notes.createdAt))
        .limit(size)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(notes),
    ])
    return {
      data: await Promise.all(rows.map((r) => this.attachTopic(mapBase(r)))),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async findRecent(
    size: number,
    options: { visibleOnly?: boolean } = {},
  ): Promise<NoteRow[]> {
    const where = options.visibleOnly ? this.visibleClause() : undefined
    const rows = await this.db
      .select()
      .from(notes)
      .where(where)
      .orderBy(desc(notes.createdAt))
      .limit(Math.max(1, size))
    return Promise.all(rows.map((r) => this.attachTopic(mapBase(r))))
  }

  async findManyByIds(ids: Array<EntityId | string>): Promise<NoteRow[]> {
    if (ids.length === 0) return []
    const bigInts = ids.map((id) => parseEntityId(id))
    const rows = await this.db
      .select()
      .from(notes)
      .where(inArray(notes.id, bigInts))
    return Promise.all(rows.map((r) => this.attachTopic(mapBase(r))))
  }

  async findIdsByTitle(search: string): Promise<EntityId[]> {
    const rows = await this.db
      .select({ id: notes.id })
      .from(notes)
      .where(ilike(notes.title, `%${search}%`))
    return rows.map((row) => toEntityId(row.id) as EntityId)
  }

  async findAdjacent(
    direction: 'before' | 'after',
    pivot: { nid: number },
    options: { visibleOnly?: boolean } = {},
  ): Promise<NoteRow | null> {
    const filters: SQL[] = [
      direction === 'before'
        ? lt(notes.nid, pivot.nid)
        : gt(notes.nid, pivot.nid),
    ]
    if (options.visibleOnly) filters.push(this.visibleClause())
    const where = and(...filters)!
    const [row] = await this.db
      .select()
      .from(notes)
      .where(where)
      .orderBy(direction === 'before' ? desc(notes.nid) : asc(notes.nid))
      .limit(1)
    if (!row) return null
    return this.attachTopic(mapBase(row))
  }

  async findByCreatedWindow(
    pivotDate: Date,
    direction: 'before' | 'after',
    limit: number,
    options: { visibleOnly?: boolean } = {},
  ): Promise<NoteRow[]> {
    const filters: SQL[] = [
      direction === 'before'
        ? lt(notes.createdAt, pivotDate)
        : gt(notes.createdAt, pivotDate),
    ]
    if (options.visibleOnly) filters.push(this.visibleClause())
    const rows = await this.db
      .select()
      .from(notes)
      .where(and(...filters))
      .orderBy(
        direction === 'before' ? desc(notes.createdAt) : asc(notes.createdAt),
      )
      .limit(Math.max(1, limit))
    return Promise.all(rows.map((r) => this.attachTopic(mapBase(r))))
  }

  async findOneByDateAndSlug(
    start: Date,
    end: Date,
    slug: string,
  ): Promise<NoteRow | null> {
    const [row] = await this.db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.slug, slug),
          sql`${notes.createdAt} >= ${start}`,
          sql`${notes.createdAt} < ${end}`,
        ),
      )
      .limit(1)
    return row ? this.attachTopic(mapBase(row)) : null
  }

  async listByTopicId(
    topicId: EntityId | string,
    page = 1,
    size = 10,
    options: { visibleOnly?: boolean } = {},
  ): Promise<PaginationResult<NoteRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const filters: SQL[] = [eq(notes.topicId, parseEntityId(topicId))]
    if (options.visibleOnly) filters.push(this.visibleClause())
    const where = and(...filters)
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(notes)
        .where(where)
        .orderBy(desc(notes.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(notes)
        .where(where),
    ])
    return {
      data: await Promise.all(rows.map((r) => this.attachTopic(mapBase(r)))),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async getTopicRecentUpdate(
    topicId: EntityId | string,
    options: { visibleOnly?: boolean } = {},
  ): Promise<Date | null> {
    const filters: SQL[] = [eq(notes.topicId, parseEntityId(topicId))]
    if (options.visibleOnly) filters.push(this.visibleClause())
    const [row] = await this.db
      .select({
        ts: sql<Date>`coalesce(${notes.modifiedAt}, ${notes.createdAt})`,
      })
      .from(notes)
      .where(and(...filters))
      .orderBy(sql`coalesce(${notes.modifiedAt}, ${notes.createdAt}) desc`)
      .limit(1)
    return row?.ts ?? null
  }

  async findOldest(): Promise<NoteRow | null> {
    const [row] = await this.db
      .select()
      .from(notes)
      .orderBy(notes.createdAt)
      .limit(1)
    return row ? this.attachTopic(mapBase(row)) : null
  }

  async setImages(id: EntityId | string, images: unknown[]): Promise<void> {
    await this.update(id, { images })
  }

  async getLatestVisible(): Promise<NoteRow | null> {
    const [row] = await this.db
      .select()
      .from(notes)
      .where(this.visibleClause())
      .orderBy(desc(notes.createdAt))
      .limit(1)
    if (!row) return null
    return this.attachTopic(mapBase(row))
  }

  async findArchiveBuckets(): Promise<
    Array<{ year: number; month: number; count: number }>
  > {
    const rows = await this.db
      .select({
        year: sql<number>`extract(year from ${notes.createdAt})::int`,
        month: sql<number>`extract(month from ${notes.createdAt})::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(notes)
      .groupBy(
        sql`extract(year from ${notes.createdAt})`,
        sql`extract(month from ${notes.createdAt})`,
      )
      .orderBy(
        sql`extract(year from ${notes.createdAt}) desc`,
        sql`extract(month from ${notes.createdAt}) desc`,
      )
    return rows.map((r) => ({
      year: Number(r.year),
      month: Number(r.month),
      count: Number(r.count ?? 0),
    }))
  }

  private async attachTopic(row: NoteRow): Promise<NoteRow> {
    if (!row.topicId) return { ...row, topic: null }
    const [topic] = await this.db
      .select({ id: topics.id, name: topics.name, slug: topics.slug })
      .from(topics)
      .where(eq(topics.id, parseEntityId(row.topicId)))
      .limit(1)
    return {
      ...row,
      topic: topic
        ? {
            id: toEntityId(topic.id) as EntityId,
            name: topic.name,
            slug: topic.slug,
          }
        : null,
    }
  }
}
