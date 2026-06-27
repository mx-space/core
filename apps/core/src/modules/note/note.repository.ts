import { Inject, Injectable } from '@nestjs/common'
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import type pkg from 'pg'

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

type NoteRowSource = Omit<typeof notes.$inferSelect, 'text' | 'content'> &
  Partial<Pick<typeof notes.$inferSelect, 'text' | 'content'>>

const mapBase = (row: NoteRowSource): NoteRow => ({
  id: toEntityId(row.id) as EntityId,
  nid: row.nid,
  title: row.title ?? '',
  slug: row.slug,
  text: row.text ?? '',
  content: row.content ?? null,
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

const noteColumns = getTableColumns(notes)
const {
  text: _noteText,
  content: _noteContent,
  ...noteMetaColumns
} = noteColumns

const yearRange = (year: number) => ({
  end: new Date(Date.UTC(year + 1, 0, 1)),
  start: new Date(Date.UTC(year, 0, 1)),
})

const createdAtDescNullsLast = sql`${notes.createdAt} desc nulls last`

const topicProjection = {
  createdAt: topics.createdAt,
  description: topics.description,
  icon: topics.icon,
  id: topics.id,
  introduce: topics.introduce,
  name: topics.name,
  slug: topics.slug,
}

type TopicProjection = {
  createdAt: Date
  description: string
  icon: string | null
  id: string
  introduce: string | null
  name: string
  slug: string
} | null

type RawNoteWithTopic = {
  bookmark: boolean
  content: string | null
  contentFormat: string
  coordinates: NoteRow['coordinates']
  createdAt: Date
  hasPassword: boolean
  id: string
  images: unknown[] | null
  isPublished: boolean
  likeCount: number
  location: string | null
  meta: Record<string, unknown> | null
  modifiedAt: Date | null
  mood: string | null
  nid: number
  noteTopicId: string | null
  publicAt: Date | null
  readCount: number
  role?: 'latest' | 'next'
  slug: string | null
  text: string | null
  title: string | null
  totalCount?: number
  topicCreatedAt: Date | null
  topicDescription: string | null
  topicIcon: string | null
  topicId: string | null
  topicIntroduce: string | null
  topicName: string | null
  topicSlug: string | null
  weather: string | null
}

const mapTopic = (topic: TopicProjection): NoteRow['topic'] => {
  if (!topic) return null
  return {
    id: toEntityId(topic.id) as EntityId,
    name: topic.name,
    slug: topic.slug,
    description: topic.description,
    introduce: topic.introduce,
    icon: topic.icon,
    createdAt: topic.createdAt,
  }
}

const mapWithTopic = (note: NoteRowSource, topic: TopicProjection): NoteRow => {
  const row = mapBase(note)
  row.topic = mapTopic(topic)
  return row
}

const mapRawNoteWithTopic = (row: RawNoteWithTopic): NoteRow => ({
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
  hasPassword: row.hasPassword,
  publicAt: row.publicAt,
  mood: row.mood,
  weather: row.weather,
  bookmark: row.bookmark,
  coordinates: row.coordinates,
  location: row.location,
  readCount: row.readCount,
  likeCount: row.likeCount,
  topicId: row.noteTopicId ? (toEntityId(row.noteTopicId) as EntityId) : null,
  topic: row.topicId
    ? {
        id: toEntityId(row.topicId) as EntityId,
        name: row.topicName ?? '',
        slug: row.topicSlug ?? '',
        description: row.topicDescription ?? '',
        introduce: row.topicIntroduce,
        icon: row.topicIcon,
        createdAt: row.topicCreatedAt!,
      }
    : null,
  createdAt: row.createdAt,
  modifiedAt: row.modifiedAt,
})

const buildDefaultVisibleNoteListSql = (metaOnly: boolean) => `
  select
    n.id as "id",
    n.nid as "nid",
    n.title as "title",
    n.slug as "slug",
    ${
      metaOnly
        ? `null::text as "text",
    null::text as "content",`
        : `n.text as "text",
    n.content as "content",`
    }
    n.content_format as "contentFormat",
    n.images as "images",
    n.meta as "meta",
    n.is_published as "isPublished",
    (n.password is not null) as "hasPassword",
    n.public_at as "publicAt",
    n.mood as "mood",
    n.weather as "weather",
    n.bookmark as "bookmark",
    n.coordinates as "coordinates",
    n.location as "location",
    n.read_count as "readCount",
    n.like_count as "likeCount",
    n.topic_id as "noteTopicId",
    n.created_at as "createdAt",
    n.modified_at as "modifiedAt",
    t.id as "topicId",
    t.name as "topicName",
    t.slug as "topicSlug",
    t.description as "topicDescription",
    t.introduce as "topicIntroduce",
    t.icon as "topicIcon",
    t.created_at as "topicCreatedAt",
    c.count as "totalCount"
  from (
    select *
    from notes
    where is_published = true
      and (public_at is null or public_at <= now())
      and password is null
    order by created_at desc nulls last
    limit 10
    offset 0
  ) n
  left join topics t on t.id = n.topic_id
  cross join (
    select count(*)::int as count
    from notes
    where is_published = true
      and (public_at is null or public_at <= now())
      and password is null
  ) c
  order by n.created_at desc nulls last
`

const defaultVisibleNoteListSql = buildDefaultVisibleNoteListSql(false)
const defaultVisibleNoteListMetaSql = buildDefaultVisibleNoteListSql(true)

const latestVisiblePairSql = `
  with latest as (
    select
      'latest'::text as "role",
      n.id as "id",
      n.nid as "nid",
      n.title as "title",
      n.slug as "slug",
      n.text as "text",
      n.content as "content",
      n.content_format as "contentFormat",
      n.images as "images",
      n.meta as "meta",
      n.is_published as "isPublished",
      (n.password is not null) as "hasPassword",
      n.public_at as "publicAt",
      n.mood as "mood",
      n.weather as "weather",
      n.bookmark as "bookmark",
      n.coordinates as "coordinates",
      n.location as "location",
      n.read_count as "readCount",
      n.like_count as "likeCount",
      n.topic_id as "noteTopicId",
      n.created_at as "createdAt",
      n.modified_at as "modifiedAt",
      t.id as "topicId",
      t.name as "topicName",
      t.slug as "topicSlug",
      t.description as "topicDescription",
      t.introduce as "topicIntroduce",
      t.icon as "topicIcon",
      t.created_at as "topicCreatedAt"
    from notes n
    left join topics t on t.id = n.topic_id
    where n.is_published = true
      and (n.public_at is null or n.public_at <= now())
      and n.password is null
    order by n.created_at desc nulls last
    limit 1
  ),
  next as (
    select
      'next'::text as "role",
      n.id as "id",
      n.nid as "nid",
      n.title as "title",
      n.slug as "slug",
      n.text as "text",
      n.content as "content",
      n.content_format as "contentFormat",
      n.images as "images",
      n.meta as "meta",
      n.is_published as "isPublished",
      (n.password is not null) as "hasPassword",
      n.public_at as "publicAt",
      n.mood as "mood",
      n.weather as "weather",
      n.bookmark as "bookmark",
      n.coordinates as "coordinates",
      n.location as "location",
      n.read_count as "readCount",
      n.like_count as "likeCount",
      n.topic_id as "noteTopicId",
      n.created_at as "createdAt",
      n.modified_at as "modifiedAt",
      t.id as "topicId",
      t.name as "topicName",
      t.slug as "topicSlug",
      t.description as "topicDescription",
      t.introduce as "topicIntroduce",
      t.icon as "topicIcon",
      t.created_at as "topicCreatedAt"
    from notes n
    left join topics t on t.id = n.topic_id
    where n.is_published = true
      and (n.public_at is null or n.public_at <= now())
      and n.password is null
      and n.created_at < (select "createdAt" from latest)
    order by n.created_at desc nulls last
    limit 1
  )
  select * from latest
  union all
  select * from next
`

@Injectable()
export class NoteRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  private get pgPool(): pkg.Pool | null {
    const client = (this.db as AppDatabase & { $client?: unknown }).$client
    if (client && typeof (client as pkg.Pool).query === 'function') {
      return client as pkg.Pool
    }
    return null
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
   * whose `publicAt` (if set) is in the past, and which are not
   * password-protected (password-protected notes must never leak through
   * public list/feed/sitemap/timeline surfaces).
   */
  private visibleClause(): SQL {
    return and(
      eq(notes.isPublished, true),
      or(sql`${notes.publicAt} is null`, lte(notes.publicAt, new Date()))!,
      isNull(notes.password),
    )!
  }

  async listVisible(
    page = 1,
    size = 10,
    options: NoteSortOptions & NoteListFilter = {},
  ): Promise<PaginationResult<NoteRow>> {
    const hasDefaultOptions =
      options.year === undefined &&
      options.sortBy === undefined &&
      options.sortOrder === undefined
    if (page === 1 && size === 10 && hasDefaultOptions) {
      const fastResult = await this.listDefaultVisibleFast(options.metaOnly)
      if (fastResult) return fastResult
    }
    return this.listInternal(page, size, options, this.visibleClause())
  }

  private async listDefaultVisibleFast(
    metaOnly = false,
  ): Promise<PaginationResult<NoteRow> | null> {
    const pool = this.pgPool
    if (!pool) return null
    const result = await pool.query<RawNoteWithTopic>({
      name: metaOnly
        ? 'notes_default_visible_list_meta_v2'
        : 'notes_default_visible_list_v2',
      text: metaOnly
        ? defaultVisibleNoteListMetaSql
        : defaultVisibleNoteListSql,
    })
    const count = result.rows[0]?.totalCount ?? 0
    return {
      data: result.rows.map(mapRawNoteWithTopic),
      pagination: this.paginationOf(Number(count), 1, 10),
    }
  }

  private async listInternal(
    page: number,
    size: number,
    options: NoteSortOptions & NoteListFilter,
    visibility?: SQL,
  ): Promise<PaginationResult<NoteRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const where = this.combineWhere(visibility, options.year)
    const orderBy = this.resolveOrderBy(options)
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({
          note: options.metaOnly ? noteMetaColumns : noteColumns,
          topic: topicProjection,
        })
        .from(notes)
        .leftJoin(topics, eq(notes.topicId, topics.id))
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
      data: rows.map((row) => mapWithTopic(row.note, row.topic)),
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
      const { start, end } = yearRange(year)
      filters.push(gte(notes.createdAt, start), lt(notes.createdAt, end))
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
    return this.listInternal(page, size, options)
  }

  /**
   * Collect every distinct mood / weather string from visible notes —
   * used by the translation glossary so historical entries are also seeded.
   */
  async findDistinctMoodsAndWeathers(): Promise<{
    moods: string[]
    weathers: string[]
  }> {
    const visible = this.visibleClause()
    const [moodRows, weatherRows] = await Promise.all([
      this.db
        .selectDistinct({ value: notes.mood })
        .from(notes)
        .where(and(visible, isNotNull(notes.mood))!),
      this.db
        .selectDistinct({ value: notes.weather })
        .from(notes)
        .where(and(visible, isNotNull(notes.weather))!),
    ])
    const pick = (rows: Array<{ value: string | null }>): string[] =>
      rows
        .map((row) => row.value)
        .filter((value): value is string => Boolean(value))
    return {
      moods: pick(moodRows),
      weathers: pick(weatherRows),
    }
  }

  async findRecent(
    size: number,
    options: { visibleOnly?: boolean; metaOnly?: boolean } = {},
  ): Promise<NoteRow[]> {
    const where = options.visibleOnly ? this.visibleClause() : undefined
    const rows = await this.db
      .select({
        note: options.metaOnly ? noteMetaColumns : noteColumns,
        topic: topicProjection,
      })
      .from(notes)
      .leftJoin(topics, eq(notes.topicId, topics.id))
      .where(where)
      .orderBy(createdAtDescNullsLast)
      .limit(Math.max(1, size))
    return rows.map((row) => mapWithTopic(row.note, row.topic))
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
    options: {
      visibleOnly?: boolean
      excludeId?: EntityId | string
    } = {},
  ): Promise<NoteRow[]> {
    const filters: SQL[] = [
      direction === 'before'
        ? lt(notes.createdAt, pivotDate)
        : gt(notes.createdAt, pivotDate),
    ]
    if (options.visibleOnly) filters.push(this.visibleClause())
    // PG timestamps have μs precision while JS Date is only ms. `gt/lt(jsDate)`
    // can include rows with sub-ms differences in createdAt (e.g. the pivot row
    // itself), so explicitly exclude them by id.
    if (options.excludeId !== undefined) {
      filters.push(ne(notes.id, parseEntityId(options.excludeId)))
    }
    const rows = await this.db
      .select()
      .from(notes)
      .where(and(...filters))
      .orderBy(
        direction === 'before' ? createdAtDescNullsLast : asc(notes.createdAt),
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
    const [row] = await this.findRecent(1, { visibleOnly: true })
    return row ?? null
  }

  async findLatestVisiblePair(): Promise<{
    latest: NoteRow
    next: NoteRow | null
  } | null> {
    const pool = this.pgPool
    const result = pool
      ? await pool.query<RawNoteWithTopic>({
          name: 'notes_latest_visible_pair_v2',
          text: latestVisiblePairSql,
        })
      : await this.db.execute<RawNoteWithTopic>(sql.raw(latestVisiblePairSql))
    const latest = result.rows.find((row) => row.role === 'latest')
    if (!latest) return null
    const next = result.rows.find((row) => row.role === 'next')
    return {
      latest: mapRawNoteWithTopic(latest),
      next: next ? mapRawNoteWithTopic(next) : null,
    }
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
      const { start, end } = yearRange(options.year)
      filters.push(gte(notes.createdAt, start), lt(notes.createdAt, end))
    }
    const orderBy =
      options.sort === 'asc' ? asc(notes.createdAt) : createdAtDescNullsLast
    const rows = await this.db
      .select({ note: noteMetaColumns, topic: topicProjection })
      .from(notes)
      .leftJoin(topics, eq(notes.topicId, topics.id))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(orderBy)
    return rows.map((row) => mapWithTopic(row.note, row.topic))
  }

  async findVisibleForSitemap(): Promise<NoteRow[]> {
    const rows = await this.db
      .select(noteMetaColumns)
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
      .select({
        id: topics.id,
        name: topics.name,
        slug: topics.slug,
        description: topics.description,
        introduce: topics.introduce,
        icon: topics.icon,
        createdAt: topics.createdAt,
      })
      .from(topics)
      .where(inArray(topics.id, topicIds))
    const topicById = new Map(
      topicRows.map((t) => [
        t.id.toString(),
        {
          id: toEntityId(t.id) as EntityId,
          name: t.name,
          slug: t.slug,
          description: t.description,
          introduce: t.introduce,
          icon: t.icon,
          createdAt: t.createdAt,
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
          createdAtDescNullsLast,
        ]
      }
      case 'title': {
        return [direction(notes.title), createdAtDescNullsLast]
      }
      case 'mood': {
        return [direction(notes.mood), createdAtDescNullsLast]
      }
      case 'weather': {
        return [direction(notes.weather), createdAtDescNullsLast]
      }
      default: {
        return sortOrder === 1
          ? [asc(notes.createdAt)]
          : [createdAtDescNullsLast]
      }
    }
  }
}
