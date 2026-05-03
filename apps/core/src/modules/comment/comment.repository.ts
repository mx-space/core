import { Inject, Injectable } from '@nestjs/common'
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  type SQL,
  sql,
} from 'drizzle-orm'

import { CollectionRefTypes } from '~/constants/db.constant'
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

export type CommentRefType = `${CollectionRefTypes}`

export interface CommentRow {
  id: EntityId
  refType: CommentRefType
  refId: EntityId
  author: string | null
  mail: string | null
  url: string | null
  text: string
  state: number
  parentCommentId: EntityId | null
  rootCommentId: EntityId | null
  replyCount: number
  latestReplyAt: Date | null
  isDeleted: boolean
  deletedAt: Date | null
  pin: boolean
  isWhispers: boolean
  avatar: string | null
  authProvider: string | null
  meta: string | null
  readerId: EntityId | null
  editedAt: Date | null
  anchor: Record<string, unknown> | null
  ip: string | null
  agent: string | null
  location: string | null
  createdAt: Date
  parent?: CommentRow | null
  children?: CommentRow[]
}

export interface CommentCreateInput {
  refType: CommentRefType
  refId: EntityId | string
  text: string
  author?: string | null
  mail?: string | null
  url?: string | null
  state?: number
  parentCommentId?: EntityId | string | null
  rootCommentId?: EntityId | string | null
  pin?: boolean
  isWhispers?: boolean
  avatar?: string | null
  authProvider?: string | null
  meta?: string | null
  readerId?: EntityId | string | null
  anchor?: Record<string, unknown> | null
  ip?: string | null
  agent?: string | null
  location?: string | null
}

export interface CommentFindFilter {
  state?: number
  refType?: CommentRefType
  refId?: EntityId | string
  search?: string
}

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
  readerId: row.readerId ? (toEntityId(row.readerId) as EntityId) : null,
  editedAt: row.editedAt,
  anchor: row.anchor,
  ip: row.ip,
  agent: row.agent,
  location: row.location,
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
  ): Promise<CommentRow | null> {
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

  async create(input: CommentCreateInput): Promise<CommentRow> {
    const id = this.snowflake.nextBigInt()
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
        readerId: input.readerId ? parseEntityId(input.readerId) : null,
        anchor: input.anchor ?? null,
        ip: input.ip ?? null,
        agent: input.agent ?? null,
        location: input.location ?? null,
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
      const id = this.snowflake.nextBigInt()
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
          readerId: input.readerId ? parseEntityId(input.readerId) : null,
          anchor: input.anchor ?? null,
          ip: input.ip ?? null,
          agent: input.agent ?? null,
          location: input.location ?? null,
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

  async countActiveByReader(readerId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .where(
        and(
          eq(comments.readerId, parseEntityId(readerId)),
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

  private buildFindFilter(filter: CommentFindFilter): SQL | undefined {
    const filters: SQL[] = []
    if (filter.state !== undefined)
      filters.push(eq(comments.state, filter.state))
    if (filter.refType)
      filters.push(
        eq(comments.refType, normalizeCommentRefType(filter.refType)),
      )
    if (filter.refId)
      filters.push(eq(comments.refId, parseEntityId(filter.refId)))
    if (filter.search) filters.push(ilike(comments.text, `%${filter.search}%`))
    return filters.length > 0 ? and(...filters) : undefined
  }
}
