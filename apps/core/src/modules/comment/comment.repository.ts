import { Inject, Injectable } from '@nestjs/common'
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { comments } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import { CommentState } from './comment.enum'
import type {
  AuthorActivityFilter,
  AuthorActivityItem,
  CommentCreateInput,
  CommentFindFilter,
  CommentPublicFilterOptions,
  CommentRefType,
  CommentRootListOptions,
  CommentRootSort,
  CommentRow,
  CommentRowWithRelations,
  CommentSourceCandidate,
  CommentTab,
  CommentTabCounts,
  CommentTabCountsFilter,
} from './comment.types'

const normalizeCommentRefType = (refType: CommentRefType): CommentRefType =>
  refType

const mapBase = (row: typeof comments.$inferSelect): CommentRow => ({
  id: toEntityId(row.id) as EntityId,
  refType: row.refType as CommentRefType,
  refId: toEntityId(row.refId) as EntityId,
  author: row.author,
  mail: row.mail,
  url: row.url,
  text: row.text,
  state: row.state,
  parentCommentId: row.parentCommentId
    ? (toEntityId(row.parentCommentId) as EntityId)
    : null,
  rootCommentId: row.rootCommentId
    ? (toEntityId(row.rootCommentId) as EntityId)
    : null,
  replyCount: row.replyCount,
  latestReplyAt: row.latestReplyAt,
  isDeleted: row.isDeleted,
  deletedAt: row.deletedAt,
  pin: row.pin,
  isWhispers: row.isWhispers,
  avatar: row.avatar,
  authProvider: row.authProvider,
  meta: row.meta,
  readerId: row.readerId,
  editedAt: row.editedAt,
  anchor: row.anchor,
  ip: row.ip,
  agent: row.agent,
  location: row.location,
  isOwnerReply: row.isOwnerReply,
  countryCode: row.countryCode,
  createdAt: row.createdAt,
})

@Injectable()
export class CommentRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findById(id: EntityId | string): Promise<CommentRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(comments)
      .where(eq(comments.id, idBig))
      .limit(1)
    return row ? mapBase(row) : null
  }

  async findByIdWithRelations(
    id: EntityId | string,
  ): Promise<CommentRowWithRelations | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(comments)
      .where(eq(comments.id, idBig))
      .limit(1)
    if (!row) return null

    const [parent, children] = await Promise.all([
      row.parentCommentId
        ? this.db
            .select()
            .from(comments)
            .where(eq(comments.id, row.parentCommentId))
            .limit(1)
        : Promise.resolve([]),
      this.db
        .select()
        .from(comments)
        .where(eq(comments.parentCommentId, idBig))
        .orderBy(asc(comments.createdAt)),
    ])

    return {
      ...mapBase(row),
      parent: parent[0] ? mapBase(parent[0]) : null,
      children: children.map(mapBase),
    }
  }

  async findThreadFor(
    refType: CommentRefType,
    refId: EntityId | string,
    page = 1,
    size = 20,
  ): Promise<PaginationResult<CommentRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const where = and(
      eq(comments.refType, normalizeCommentRefType(refType)),
      eq(comments.refId, parseEntityId(refId)),
      sql`${comments.parentCommentId} is null`,
      eq(comments.isDeleted, false),
    )!
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(comments)
        .where(where)
        .orderBy(desc(comments.pin), desc(comments.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(comments)
        .where(where),
    ])
    return {
      data: rows.map(mapBase),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async findReplies(
    rootCommentId: EntityId | string,
    page = 1,
    size = 20,
  ): Promise<PaginationResult<CommentRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const where = and(
      eq(comments.rootCommentId, parseEntityId(rootCommentId)),
      eq(comments.isDeleted, false),
    )!
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(comments)
        .where(where)
        .orderBy(asc(comments.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(comments)
        .where(where),
    ])
    return {
      data: rows.map(mapBase),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async findRootThreadsByRef(
    refId: EntityId | string,
    options: CommentRootListOptions,
  ): Promise<PaginationResult<CommentRow>> {
    const size = Math.min(50, Math.max(1, options.size))
    let page = Math.max(1, options.page)
    const baseFilters = this.buildPublicThreadFilters(options)

    if (options.around) {
      const aroundPage = await this.findPageContainingRootComment(
        refId,
        options.around,
        size,
        options.sort,
        baseFilters,
      )
      if (aroundPage !== null) page = aroundPage
    }

    const offset = (page - 1) * size
    const where = and(
      eq(comments.refId, parseEntityId(refId)),
      sql`${comments.parentCommentId} is null`,
      ...baseFilters,
    )!
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(comments)
        .where(where)
        .orderBy(...this.orderByRootThreads(options.sort))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(comments)
        .where(where),
    ])

    return {
      data: rows.map(mapBase),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async findVisibleRepliesForRoots(
    rootCommentIds: Array<EntityId | string>,
    options: CommentPublicFilterOptions,
  ): Promise<CommentRow[]> {
    if (rootCommentIds.length === 0) return []
    const rows = await this.db
      .select()
      .from(comments)
      .where(
        and(
          inArray(
            comments.rootCommentId,
            rootCommentIds.map((id) => parseEntityId(id)),
          ),
          sql`${comments.parentCommentId} is not null`,
          ...this.buildPublicThreadFilters(options),
        ),
      )
      .orderBy(asc(comments.createdAt))
    return rows.map(mapBase)
  }

  async findVisibleRepliesForRoot(
    rootCommentId: EntityId | string,
    options: CommentPublicFilterOptions,
  ): Promise<CommentRow[]> {
    return this.findVisibleRepliesForRoots([rootCommentId], options)
  }

  async findAdminThreadByRoot(
    rootCommentId: EntityId | string,
  ): Promise<CommentRow[]> {
    const rootBig = parseEntityId(rootCommentId)
    const rows = await this.db
      .select()
      .from(comments)
      .where(or(eq(comments.id, rootBig), eq(comments.rootCommentId, rootBig)))
      .orderBy(asc(comments.createdAt))
    const mapped = rows.map(mapBase)
    const rootIndex = mapped.findIndex(
      (row) => String(row.id) === String(rootBig),
    )
    if (rootIndex > 0) {
      const [root] = mapped.splice(rootIndex, 1)
      mapped.unshift(root)
    }
    return mapped
  }

  async create(input: CommentCreateInput): Promise<CommentRow> {
    const id = this.snowflake.nextId()
    const [row] = await this.db
      .insert(comments)
      .values({
        id,
        refType: normalizeCommentRefType(input.refType),
        refId: parseEntityId(input.refId),
        text: input.text,
        author: input.author ?? null,
        mail: input.mail ?? null,
        url: input.url ?? null,
        state: input.state ?? 0,
        parentCommentId: input.parentCommentId
          ? parseEntityId(input.parentCommentId)
          : null,
        rootCommentId: input.rootCommentId
          ? parseEntityId(input.rootCommentId)
          : null,
        pin: input.pin ?? false,
        isWhispers: input.isWhispers ?? false,
        avatar: input.avatar ?? null,
        authProvider: input.authProvider ?? null,
        meta: input.meta ?? null,
        readerId: input.readerId ?? null,
        anchor: input.anchor ?? null,
        ip: input.ip ?? null,
        agent: input.agent ?? null,
        location: input.location ?? null,
        isOwnerReply: input.isOwnerReply ?? false,
        countryCode: input.countryCode ?? null,
      })
      .returning()
    return mapBase(row)
  }

  /**
   * Atomic reply insertion that updates parent + root counters.
   */
  async createReply(input: CommentCreateInput): Promise<CommentRow> {
    if (!input.parentCommentId) {
      throw new Error('createReply requires parentCommentId')
    }
    const parentBig = parseEntityId(input.parentCommentId)
    return this.db.transaction(async (tx) => {
      const [parent] = await tx
        .select()
        .from(comments)
        .where(eq(comments.id, parentBig))
        .limit(1)
      if (!parent) throw new Error('parent comment not found')
      const rootBig = parent.rootCommentId ?? parent.id
      const id = this.snowflake.nextId()
      const now = new Date()
      const [reply] = await tx
        .insert(comments)
        .values({
          id,
          refType: normalizeCommentRefType(input.refType),
          refId: parseEntityId(input.refId),
          text: input.text,
          author: input.author ?? null,
          mail: input.mail ?? null,
          url: input.url ?? null,
          state: input.state ?? 0,
          parentCommentId: parentBig,
          rootCommentId: rootBig,
          isWhispers: input.isWhispers ?? false,
          avatar: input.avatar ?? null,
          authProvider: input.authProvider ?? null,
          meta: input.meta ?? null,
          readerId: input.readerId ?? null,
          anchor: input.anchor ?? null,
          ip: input.ip ?? null,
          agent: input.agent ?? null,
          location: input.location ?? null,
          isOwnerReply: input.isOwnerReply ?? false,
          countryCode: input.countryCode ?? null,
        })
        .returning()
      await tx
        .update(comments)
        .set({
          replyCount: sql`${comments.replyCount} + 1`,
          latestReplyAt: now,
        })
        .where(eq(comments.id, rootBig))
      return mapBase(reply)
    })
  }

  async update(
    id: EntityId | string,
    patch: Partial<{
      text: string
      state: number
      pin: boolean
      isDeleted: boolean
      isWhispers: boolean
      meta: string | null
      anchor: Record<string, unknown> | null
      editedAt: Date | null
      location: string | null
    }>,
  ): Promise<CommentRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof comments.$inferInsert> = {}
    if (patch.text !== undefined) update.text = patch.text
    if (patch.state !== undefined) update.state = patch.state
    if (patch.pin !== undefined) update.pin = patch.pin
    if (patch.isDeleted !== undefined) {
      update.isDeleted = patch.isDeleted
      update.deletedAt = patch.isDeleted ? new Date() : null
    }
    if (patch.isWhispers !== undefined) update.isWhispers = patch.isWhispers
    if (patch.meta !== undefined) update.meta = patch.meta
    if (patch.anchor !== undefined) update.anchor = patch.anchor
    if (patch.editedAt !== undefined) update.editedAt = patch.editedAt
    if (patch.location !== undefined) update.location = patch.location
    const [row] = await this.db
      .update(comments)
      .set(update)
      .where(eq(comments.id, idBig))
      .returning()
    return row ? mapBase(row) : null
  }

  async deleteById(id: EntityId | string): Promise<CommentRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(comments)
      .where(eq(comments.id, idBig))
      .returning()
    return row ? mapBase(row) : null
  }

  async countForRef(
    refType: CommentRefType,
    refId: EntityId | string,
    extra?: SQL,
  ): Promise<number> {
    const where = and(
      eq(comments.refType, normalizeCommentRefType(refType)),
      eq(comments.refId, parseEntityId(refId)),
      eq(comments.isDeleted, false),
      ...(extra ? [extra] : []),
    )!
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .where(where)
    return Number(row?.count ?? 0)
  }

  async countByRef(
    refType: CommentRefType,
    refId: EntityId | string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .where(
        and(
          eq(comments.refType, normalizeCommentRefType(refType)),
          eq(comments.refId, parseEntityId(refId)),
        ),
      )
    return Number(row?.count ?? 0)
  }

  async countManyByRef(
    refType: CommentRefType,
    refIds: Array<EntityId | string>,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>()
    if (refIds.length === 0) return result
    const ids = [...new Set(refIds.map((id) => parseEntityId(id)))]
    const rows = await this.db
      .select({
        refId: comments.refId,
        count: sql<number>`count(*)::int`,
      })
      .from(comments)
      .where(
        and(
          eq(comments.refType, normalizeCommentRefType(refType)),
          inArray(comments.refId, ids),
        ),
      )
      .groupBy(comments.refId)
    for (const r of rows) {
      if (r.refId) result.set(r.refId.toString(), Number(r.count ?? 0))
    }
    return result
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
    return Number(row?.count ?? 0)
  }

  async countByState(state: number, rootOnly = false): Promise<number> {
    const filters: SQL[] = [
      eq(comments.state, state),
      eq(comments.isDeleted, false),
    ]
    if (rootOnly) filters.push(sql`${comments.parentCommentId} is null`)
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .where(and(...filters))
    return Number(row?.count ?? 0)
  }

  async aggregateDailyActivity(options: {
    from: Date
    to: Date
    states: number[]
  }): Promise<Array<{ date: string; count: number }>> {
    if (options.states.length === 0) return []
    const dayExpr = sql<string>`to_char(${comments.createdAt}, 'YYYY-MM-DD')`
    const filters: SQL[] = [
      gte(comments.createdAt, options.from),
      lte(comments.createdAt, options.to),
      inArray(comments.state, options.states),
      eq(comments.isDeleted, false),
    ]
    const rows = await this.db
      .select({
        date: dayExpr,
        count: sql<number>`count(*)::int`,
      })
      .from(comments)
      .where(and(...filters))
      .groupBy(dayExpr)
      .orderBy(asc(dayExpr))
    return rows.map((r) => ({ date: r.date, count: Number(r.count ?? 0) }))
  }

  async countActiveByReader(readerId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .where(
        and(
          eq(comments.readerId, readerId),
          eq(comments.isDeleted, false),
          ne(comments.state, 2),
        )!,
      )
    return Number(row?.count ?? 0)
  }

  async findRecent(
    size: number,
    options: { state?: number; rootOnly?: boolean } = {},
  ): Promise<CommentRow[]> {
    const filters: SQL[] = [eq(comments.isDeleted, false)]
    if (options.state !== undefined)
      filters.push(eq(comments.state, options.state))
    if (options.rootOnly) filters.push(sql`${comments.parentCommentId} is null`)
    const rows = await this.db
      .select()
      .from(comments)
      .where(and(...filters))
      .orderBy(desc(comments.createdAt))
      .limit(Math.max(1, size))
    return rows.map(mapBase)
  }

  async findManyByIds(ids: Array<EntityId | string>): Promise<CommentRow[]> {
    if (ids.length === 0) return []
    const bigInts = ids.map((id) => parseEntityId(id))
    const rows = await this.db
      .select()
      .from(comments)
      .where(inArray(comments.id, bigInts))
    return rows.map(mapBase)
  }

  async findByRefIds(
    refType: CommentRefType,
    refIds: Array<EntityId | string>,
  ): Promise<CommentRow[]> {
    if (refIds.length === 0) return []
    const bigInts = refIds.map((id) => parseEntityId(id))
    const rows = await this.db
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.refType, normalizeCommentRefType(refType)),
          inArray(comments.refId, bigInts),
          eq(comments.isDeleted, false),
        )!,
      )
    return rows.map(mapBase)
  }

  async deleteForRef(
    refType: CommentRefType,
    refId: EntityId | string,
  ): Promise<number> {
    const result = await this.db
      .delete(comments)
      .where(
        and(
          eq(comments.refType, normalizeCommentRefType(refType)),
          eq(comments.refId, parseEntityId(refId)),
        )!,
      )
      .returning({ id: comments.id })
    return result.length
  }

  async updateStateForRef(
    refType: CommentRefType,
    refId: EntityId | string,
    state: number,
  ): Promise<number> {
    const result = await this.db
      .update(comments)
      .set({ state })
      .where(
        and(
          eq(comments.refType, normalizeCommentRefType(refType)),
          eq(comments.refId, parseEntityId(refId)),
        )!,
      )
      .returning({ id: comments.id })
    return result.length
  }

  async updateStateBulk(
    ids: Array<EntityId | string>,
    state: number,
  ): Promise<number> {
    if (ids.length === 0) return 0
    const bigInts = ids.map((id) => parseEntityId(id))
    const result = await this.db
      .update(comments)
      .set({ state })
      .where(inArray(comments.id, bigInts))
      .returning({ id: comments.id })
    return result.length
  }

  async updateStateByFilter(
    filter: CommentFindFilter,
    state: number,
  ): Promise<number> {
    const result = await this.db
      .update(comments)
      .set({ state })
      .where(this.buildFindFilter(filter))
      .returning({ id: comments.id })
    return result.length
  }

  async paginatedFind(
    filter: CommentFindFilter,
    page = 1,
    size = 10,
  ): Promise<PaginationResult<CommentRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const where = this.buildFindFilter(filter)
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(comments)
        .where(where)
        .orderBy(desc(comments.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(comments)
        .where(where),
    ])
    return {
      data: rows.map(mapBase),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async findByFilter(filter: CommentFindFilter): Promise<CommentRow[]> {
    const rows = await this.db
      .select()
      .from(comments)
      .where(this.buildFindFilter(filter))
      .orderBy(desc(comments.createdAt))
    return rows.map(mapBase)
  }

  async findSourceCandidates(options: {
    refType?: CommentRefType
    size?: number
  }): Promise<CommentSourceCandidate[]> {
    const filters: SQL[] = []
    if (options.refType)
      filters.push(
        eq(comments.refType, normalizeCommentRefType(options.refType)),
      )
    const where = filters.length ? and(...filters) : undefined
    const rows = await this.db
      .select({
        refType: comments.refType,
        refId: comments.refId,
        count: sql<number>`count(*)::int`,
        latestCommentAt: sql<Date>`max(${comments.createdAt})`,
      })
      .from(comments)
      .where(where)
      .groupBy(comments.refType, comments.refId)
      .orderBy(desc(sql`max(${comments.createdAt})`))
      .limit(Math.min(100, Math.max(1, options.size ?? 30)))

    return rows
      .filter((row) => row.refId)
      .map((row) => ({
        refType: row.refType as CommentRefType,
        refId: toEntityId(row.refId!) as EntityId,
        count: Number(row.count ?? 0),
        latestCommentAt: row.latestCommentAt,
      }))
  }

  private buildFindFilter(filter: CommentFindFilter): SQL | undefined {
    const filters: SQL[] = []
    if (filter.tab) {
      filters.push(...this.tabPredicate(filter.tab))
    } else if (filter.state !== undefined) {
      filters.push(eq(comments.state, filter.state))
    }
    if (filter.refType)
      filters.push(
        eq(comments.refType, normalizeCommentRefType(filter.refType)),
      )
    if (filter.refId)
      filters.push(eq(comments.refId, parseEntityId(filter.refId)))
    if (filter.search) filters.push(ilike(comments.text, `%${filter.search}%`))
    if (filter.author) {
      const needle = filter.author.trim()
      if (needle) {
        // Match either mail or origin IP — used by the spec §6.2 "View all
        // activity by this author" navigation from the detail sidebar.
        filters.push(
          or(eq(comments.mail, needle), eq(comments.ip, needle)) as SQL,
        )
      }
    }
    return filters.length > 0 ? and(...filters) : undefined
  }

  /**
   * Tab → SQL predicate fragments. Mirrors the `COUNT(*) FILTER (WHERE …)`
   * branches in `getTabCounts` so list and counts stay in sync (spec §6.1).
   */
  private tabPredicate(tab: CommentTab): SQL[] {
    switch (tab) {
      case 'unread': {
        return [
          eq(comments.state, CommentState.Unread),
          eq(comments.isDeleted, false),
        ]
      }
      case 'read': {
        return [
          eq(comments.state, CommentState.Read),
          eq(comments.isDeleted, false),
        ]
      }
      case 'junk': {
        return [eq(comments.state, CommentState.Junk)]
      }
      case 'whispers': {
        return [eq(comments.isWhispers, true), eq(comments.isDeleted, false)]
      }
      case 'awaiting': {
        return [
          ne(comments.state, CommentState.Junk),
          eq(comments.isDeleted, false),
          sql`NOT EXISTS (
            SELECT 1 FROM ${comments} AS owner_reply
            WHERE owner_reply.root_comment_id = COALESCE(${comments.rootCommentId}, ${comments.id})
              AND owner_reply.is_owner_reply = TRUE
              AND owner_reply.created_at > ${comments.createdAt}
          )`,
        ]
      }
      case 'all': {
        return [eq(comments.isDeleted, false)]
      }
    }
  }

  /**
   * Single-round-trip tab counts (spec §6.1).
   *
   * Uses Postgres `COUNT(*) FILTER (WHERE …)` so every tab share the same
   * scan + the same `refType`/`refId` predicate.
   */
  async getTabCounts(
    filter: CommentTabCountsFilter = {},
  ): Promise<CommentTabCounts> {
    const refTypeValue = filter.refType
      ? normalizeCommentRefType(filter.refType)
      : null
    const refIdValue = filter.refId ? parseEntityId(filter.refId) : null

    const result = await this.db.execute<{
      unread: number
      read: number
      junk: number
      whispers: number
      awaiting: number
      all: number
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE state = 0 AND is_deleted = false)::int AS unread,
        COUNT(*) FILTER (WHERE state = 1 AND is_deleted = false)::int AS read,
        COUNT(*) FILTER (WHERE state = 2)::int                         AS junk,
        COUNT(*) FILTER (WHERE is_whispers = true AND is_deleted = false)::int AS whispers,
        COUNT(*) FILTER (
          WHERE state != 2 AND is_deleted = false AND NOT EXISTS (
            SELECT 1 FROM ${comments} AS owner_reply
            WHERE owner_reply.root_comment_id = COALESCE(${comments.rootCommentId}, ${comments.id})
              AND owner_reply.is_owner_reply = true
              AND owner_reply.created_at > ${comments.createdAt}
          )
        )::int AS awaiting,
        COUNT(*) FILTER (WHERE is_deleted = false)::int AS "all"
      FROM ${comments}
      WHERE (${refTypeValue}::text IS NULL OR ref_type = ${refTypeValue})
        AND (${refIdValue}::text IS NULL OR ref_id  = ${refIdValue})
    `)

    const row = result.rows[0]
    return {
      unread: Number(row?.unread ?? 0),
      read: Number(row?.read ?? 0),
      junk: Number(row?.junk ?? 0),
      whispers: Number(row?.whispers ?? 0),
      awaiting: Number(row?.awaiting ?? 0),
      all: Number(row?.all ?? 0),
    }
  }

  /**
   * Activity feed for the detail sidebar (spec §6.3).
   *
   * `mail` OR `ip` matches; consumers must supply at least one (enforced by
   * the schema, re-checked at the boundary for callers that bypass DTOs).
   */
  async getAuthorActivity(
    filter: AuthorActivityFilter & { limit?: number },
  ): Promise<{
    items: AuthorActivityItem[]
    totalCount: number
    firstSeenAt: Date | null
    lastSeenAt: Date | null
    junkInLast30Days: number
    sameNetJunkInLast7Days: number
  }> {
    const mail = filter.mail?.trim() || null
    const ip = filter.ip?.trim() || null
    if (!mail && !ip) {
      return {
        items: [],
        totalCount: 0,
        firstSeenAt: null,
        lastSeenAt: null,
        junkInLast30Days: 0,
        sameNetJunkInLast7Days: 0,
      }
    }

    const limit = Math.min(50, Math.max(1, filter.limit ?? 5))
    const identityClauses: SQL[] = []
    if (mail) identityClauses.push(eq(comments.mail, mail))
    if (ip) identityClauses.push(eq(comments.ip, ip))
    const identityFilter =
      identityClauses.length === 1
        ? identityClauses[0]!
        : (or(...identityClauses) as SQL)

    const itemsRows = await this.db
      .select({
        id: comments.id,
        createdAt: comments.createdAt,
        refType: comments.refType,
        refId: comments.refId,
        text: comments.text,
        state: comments.state,
        isDeleted: comments.isDeleted,
      })
      .from(comments)
      .where(identityFilter)
      .orderBy(desc(comments.createdAt))
      .limit(limit)

    const [aggregateRow] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        firstSeenAt: sql<Date | null>`min(${comments.createdAt})`,
        lastSeenAt: sql<Date | null>`max(${comments.createdAt})`,
        junkInLast30Days: sql<number>`count(*) FILTER (
          WHERE ${comments.state} = ${CommentState.Junk}
            AND ${comments.createdAt} > now() - interval '30 days'
        )::int`,
      })
      .from(comments)
      .where(identityFilter)

    // /24 IP cohort: same first three octets, junk in the last 7 days.
    let sameNetJunkInLast7Days = 0
    if (ip) {
      const slash24 = this.toSlash24Prefix(ip)
      if (slash24) {
        const [netRow] = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(comments)
          .where(
            and(
              eq(comments.state, CommentState.Junk),
              sql`${comments.ip} LIKE ${`${slash24}.%`}`,
              sql`${comments.createdAt} > now() - interval '7 days'`,
            )!,
          )
        sameNetJunkInLast7Days = Number(netRow?.count ?? 0)
      }
    }

    const items: AuthorActivityItem[] = itemsRows.map((row) => ({
      id: toEntityId(row.id) as EntityId,
      createdAt: row.createdAt,
      refType: row.refType as CommentRefType,
      refId: toEntityId(row.refId) as EntityId,
      textExcerpt: this.makeExcerpt(row.text, 120),
      state: row.state,
      isDeleted: row.isDeleted,
    }))

    return {
      items,
      totalCount: Number(aggregateRow?.total ?? 0),
      firstSeenAt: aggregateRow?.firstSeenAt ?? null,
      lastSeenAt: aggregateRow?.lastSeenAt ?? null,
      junkInLast30Days: Number(aggregateRow?.junkInLast30Days ?? 0),
      sameNetJunkInLast7Days,
    }
  }

  private toSlash24Prefix(ip: string): string | null {
    const ipv4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (!ipv4) return null
    return `${ipv4[1]}.${ipv4[2]}.${ipv4[3]}`
  }

  private makeExcerpt(text: string, max: number): string {
    const t = text.trim().replaceAll(/\s+/g, ' ')
    return t.length <= max ? t : `${t.slice(0, max - 1)}…`
  }

  private buildPublicThreadFilters({
    isAuthenticated,
    commentShouldAudit,
    hasAnchor,
  }: CommentPublicFilterOptions): SQL[] {
    const filters: SQL[] = [eq(comments.isDeleted, false)]
    if (commentShouldAudit) {
      filters.push(eq(comments.state, CommentState.Read))
    } else {
      filters.push(
        inArray(comments.state, [CommentState.Unread, CommentState.Read]),
      )
    }
    if (!isAuthenticated) {
      filters.push(eq(comments.isWhispers, false))
    }
    if (hasAnchor) {
      filters.push(sql`${comments.anchor} is not null`)
    }
    return filters
  }

  private orderByRootThreads(sort: CommentRootSort): SQL[] {
    if (sort === 'oldest') return [asc(comments.createdAt)]
    if (sort === 'newest') return [desc(comments.createdAt)]
    return [desc(comments.pin), desc(comments.createdAt)]
  }

  private async findPageContainingRootComment(
    refId: EntityId | string,
    commentId: EntityId | string,
    size: number,
    sort: CommentRootSort,
    filters: SQL[],
  ): Promise<number | null> {
    let refIdBig: EntityId
    let commentIdBig: EntityId
    try {
      refIdBig = parseEntityId(refId)
      commentIdBig = parseEntityId(commentId)
    } catch {
      return null
    }

    const baseWhere = and(
      eq(comments.refId, refIdBig),
      sql`${comments.parentCommentId} is null`,
      ...filters,
    )!
    const [target] = await this.db
      .select({
        createdAt: comments.createdAt,
        pin: comments.pin,
      })
      .from(comments)
      .where(and(eq(comments.id, commentIdBig), baseWhere))
      .limit(1)
    if (!target) return null

    let beforeFilter: SQL
    if (sort === 'oldest') {
      beforeFilter = sql`${comments.createdAt} < ${target.createdAt}`
    } else if (sort === 'newest') {
      beforeFilter = sql`${comments.createdAt} > ${target.createdAt}`
    } else if (target.pin) {
      beforeFilter = and(
        eq(comments.pin, true),
        sql`${comments.createdAt} > ${target.createdAt}`,
      )!
    } else {
      beforeFilter = sql`(${comments.pin} = true or ${comments.createdAt} > ${target.createdAt})`
    }

    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .where(and(baseWhere, beforeFilter!))

    return Math.floor(Number(row?.count ?? 0) / size) + 1
  }
}
