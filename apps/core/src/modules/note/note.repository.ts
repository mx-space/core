import { Inject, Injectable } from '@nestjs/common'
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
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

import type {
  NoteCreateInput,
  NoteListFilter,
  NotePatchInput,
  NoteRow,
  NoteSortOptions,
} from './note.types'

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
    const [withTopic] = await this.attachTopics([mapBase(row)])
    return withTopic
  }

  async findByNid(nid: number): Promise<NoteRow | null> {
    const [row] = await this.db
      .select()
      .from(notes)
      .where(eq(notes.nid, nid))
      .limit(1)
    if (!row) return null
    const [withTopic] = await this.attachTopics([mapBase(row)])
    return withTopic
  }

  async findBySlug(slug: string): Promise<NoteRow | null> {
    const [row] = await this.db
      .select()
      .from(notes)
      .where(eq(notes.slug, slug))
      .limit(1)
    if (!row) return null
    const [withTopic] = await this.attachTopics([mapBase(row)])
    return withTopic
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

  async listVisible(
    page = 1,
    size = 10,
    options: NoteSortOptions & NoteListFilter = {},
  ): Promise<PaginationResult<NoteRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const where = this.combineWhere(this.visibleClause(), options.year)
    const orderBy = this.resolveOrderBy(options)
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(notes)
        .where(where)
        .orderBy(...orderBy)
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(notes)
        .where(where),
    ])
    const data = await this.attachTopics(rows.map(mapBase))
    return {
      data,
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  private combineWhere(
    visibility: SQL | undefined,
    year?: number,
  ): SQL | undefined {
    const filters: SQL[] = []
    if (visibility) filters.push(visibility)
    if (year !== undefined) {
      filters.push(sql`extract(year from ${notes.createdAt})::int = ${year}`)
    }
    if (filters.length === 0) return undefined
    if (filters.length === 1) return filters[0]
    return and(...filters)
  }

  async create(input: NoteCreateInput): Promise<NoteRow> {
    const id = this.snowflake.nextId()
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
    const [withTopic] = await this.attachTopics([mapBase(row)])
    return withTopic
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
    if (!row) return null
    const [withTopic] = await this.attachTopics([mapBase(row)])
    return withTopic
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

  async listAll(
    page = 1,
    size = 10,
    options: NoteSortOptions & NoteListFilter = {},
  ): Promise<PaginationResult<NoteRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const where = this.combineWhere(undefined, options.year)
    const orderBy = this.resolveOrderBy(options)
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(notes)
        .where(where)
        .orderBy(...orderBy)
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(notes)
        .where(where),
    ])
    return {
      data: await this.attachTopics(rows.map(mapBase)),
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
    return this.attachTopics(rows.map(mapBase))
  }

  async findManyByIds(ids: Array<EntityId | string>): Promise<NoteRow[]> {
    if (ids.length === 0) return []
    const bigInts = ids.map((id) => parseEntityId(id))
    const rows = await this.db
      .select()
      .from(notes)
      .where(inArray(notes.id, bigInts))
    return this.attachTopics(rows.map(mapBase))
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
    const [withTopic] = await this.attachTopics([mapBase(row)])
    return withTopic
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
    return this.attachTopics(rows.map(mapBase))
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
    if (!row) return null
    const [withTopic] = await this.attachTopics([mapBase(row)])
    return withTopic
  }

  async listByTopicId(
    topicId: EntityId | string,
    page = 1,
    size = 10,
    options: { visibleOnly?: boolean } & NoteSortOptions = {},
  ): Promise<PaginationResult<NoteRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const filters: SQL[] = [eq(notes.topicId, parseEntityId(topicId))]
    if (options.visibleOnly) filters.push(this.visibleClause())
    const where = and(...filters)
    const orderBy = this.resolveOrderBy(options)
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(notes)
        .where(where)
        .orderBy(...orderBy)
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(notes)
        .where(where),
    ])
    return {
      data: await this.attachTopics(rows.map(mapBase)),
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
    if (!row) return null
    const [withTopic] = await this.attachTopics([mapBase(row)])
    return withTopic
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
    const [withTopic] = await this.attachTopics([mapBase(row)])
    return withTopic
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

  async aggregateReadAndLikeSums(): Promise<{
    totalReads: number
    totalLikes: number
  }> {
    const [row] = await this.db
      .select({
        totalReads: sql<number>`coalesce(sum(${notes.readCount}), 0)::int`,
        totalLikes: sql<number>`coalesce(sum(${notes.likeCount}), 0)::int`,
      })
      .from(notes)
    return {
      totalReads: Number(row?.totalReads ?? 0),
      totalLikes: Number(row?.totalLikes ?? 0),
    }
  }

  async findFirstCreatedAtVisible(): Promise<Date | null> {
    const [row] = await this.db
      .select({ createdAt: notes.createdAt })
      .from(notes)
      .where(this.visibleClause())
      .orderBy(asc(notes.createdAt))
      .limit(1)
    return row?.createdAt ?? null
  }

  async aggregateMonthlyTrend(options: {
    from: Date
    to: Date
    visibleOnly?: boolean
  }): Promise<Array<{ date: string; count: number }>> {
    const filters: SQL[] = [
      gte(notes.createdAt, options.from),
      lte(notes.createdAt, options.to),
    ]
    if (options.visibleOnly) filters.push(this.visibleClause())
    const monthExpr = sql<string>`to_char(${notes.createdAt}, 'YYYY-MM')`
    const rows = await this.db
      .select({
        date: monthExpr,
        count: sql<number>`count(*)::int`,
      })
      .from(notes)
      .where(and(...filters))
      .groupBy(monthExpr)
      .orderBy(asc(monthExpr))
    return rows.map((r) => ({ date: r.date, count: Number(r.count ?? 0) }))
  }

  async sumTextLength(): Promise<number> {
    const [row] = await this.db
      .select({
        total: sql<number>`coalesce(sum(char_length(coalesce(${notes.text}, ''))), 0)::bigint`,
      })
      .from(notes)
    return Number(row?.total ?? 0)
  }

  async findByYearForTimeline(options: {
    year?: number
    sort: 'asc' | 'desc'
    visibleOnly?: boolean
  }): Promise<NoteRow[]> {
    const filters: SQL[] = []
    if (options.visibleOnly) filters.push(this.visibleClause())
    if (options.year !== undefined) {
      filters.push(
        sql`extract(year from ${notes.createdAt})::int = ${options.year}`,
      )
    }
    const orderBy =
      options.sort === 'asc' ? asc(notes.createdAt) : desc(notes.createdAt)
    const rows = await this.db
      .select()
      .from(notes)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(orderBy)
    return this.attachTopics(rows.map(mapBase))
  }

  async findVisibleForSitemap(): Promise<NoteRow[]> {
    const rows = await this.db
      .select()
      .from(notes)
      .where(this.visibleClause())
      .orderBy(desc(notes.createdAt))
    return this.attachTopics(rows.map(mapBase))
  }

  private async attachTopics(rows: NoteRow[]): Promise<NoteRow[]> {
    if (rows.length === 0) return rows
    const topicIdSet = new Set<string>()
    for (const row of rows) {
      if (row.topicId) topicIdSet.add(row.topicId.toString())
    }
    if (topicIdSet.size === 0) {
      for (const row of rows) row.topic = null
      return rows
    }
    const topicIds = [...topicIdSet]
    const topicRows = await this.db
      .select({ id: topics.id, name: topics.name, slug: topics.slug })
      .from(topics)
      .where(inArray(topics.id, topicIds))
    const topicById = new Map(
      topicRows.map((t) => [
        t.id.toString(),
        {
          id: toEntityId(t.id) as EntityId,
          name: t.name,
          slug: t.slug,
        },
      ]),
    )
    for (const row of rows) {
      row.topic = row.topicId
        ? (topicById.get(row.topicId.toString()) ?? null)
        : null
    }
    return rows
  }

  private resolveOrderBy(options: NoteSortOptions): SQL[] {
    const { sortBy, sortOrder } = options
    const direction = sortOrder === 1 ? asc : desc
    switch (sortBy) {
      case 'modifiedAt': {
        return [
          direction(sql`coalesce(${notes.modifiedAt}, ${notes.createdAt})`),
          desc(notes.createdAt),
        ]
      }
      case 'title': {
        return [direction(notes.title), desc(notes.createdAt)]
      }
      case 'mood': {
        return [direction(notes.mood), desc(notes.createdAt)]
      }
      case 'weather': {
        return [direction(notes.weather), desc(notes.createdAt)]
      }
      default: {
        return [direction(notes.createdAt)]
      }
    }
  }
}
