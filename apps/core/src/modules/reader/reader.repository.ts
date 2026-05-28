import { Inject, Injectable } from '@nestjs/common'
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  ne,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { readers, sessions } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'

import type { ReaderRow } from './reader.types'

export type ReaderRoleFilter = 'all' | 'owner' | 'reader'

export interface ReaderListParams {
  page?: number
  size?: number
  search?: string
  role?: ReaderRoleFilter
}

export interface ReaderRoleCounts {
  all: number
  owner: number
  reader: number
  banned: number
}

const mapRow = (row: typeof readers.$inferSelect): ReaderRow => ({
  id: row.id,
  email: row.email,
  emailVerified: row.emailVerified,
  name: row.name,
  handle: row.handle,
  username: row.username,
  displayUsername: row.displayUsername,
  image: row.image,
  role: row.role,
  bannedAt: row.bannedAt,
  banReason: row.banReason,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

const readerSelection = {
  id: readers.id,
  email: readers.email,
  emailVerified: readers.emailVerified,
  name: readers.name,
  handle: readers.handle,
  username: readers.username,
  displayUsername: readers.displayUsername,
  image: readers.image,
  role: readers.role,
  bannedAt: readers.bannedAt,
  banReason: readers.banReason,
  createdAt: readers.createdAt,
  updatedAt: readers.updatedAt,
} as const

@Injectable()
export class ReaderRepository extends BaseRepository {
  constructor(@Inject(PG_DB_TOKEN) db: AppDatabase) {
    super(db)
  }

  async findById(id: string): Promise<ReaderRow | null> {
    const [row] = await this.db
      .select()
      .from(readers)
      .where(eq(readers.id, id))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByEmail(email: string): Promise<ReaderRow | null> {
    const [row] = await this.db
      .select()
      .from(readers)
      .where(eq(readers.email, email))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByUsername(username: string): Promise<ReaderRow | null> {
    const [row] = await this.db
      .select()
      .from(readers)
      .where(eq(readers.username, username))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async existsByUsernameOrEmail(username: string, email: string) {
    const [row] = await this.db
      .select({ id: readers.id })
      .from(readers)
      .where(or(eq(readers.username, username), eq(readers.email, email)))
      .limit(1)
    return !!row
  }

  async findOwner(): Promise<ReaderRow | null> {
    const [row] = await this.db
      .select()
      .from(readers)
      .where(eq(readers.role, 'owner'))
      .orderBy(asc(readers.createdAt), asc(readers.id))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async countOwners(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(readers)
      .where(eq(readers.role, 'owner'))
    return Number(row?.count ?? 0)
  }

  async setRole(id: string, role: string): Promise<boolean> {
    const result = await this.db
      .update(readers)
      .set({ role, updatedAt: new Date() })
      .where(eq(readers.id, id))
      .returning({ id: readers.id })
    return result.length > 0
  }

  async setOwnersExceptToReader(id: string): Promise<void> {
    await this.db
      .update(readers)
      .set({ role: 'reader', updatedAt: new Date() })
      .where(and(eq(readers.role, 'owner'), ne(readers.id, id))!)
  }

  async findByIds(ids: string[]): Promise<ReaderRow[]> {
    if (ids.length === 0) return []

    const directRows = await this.db
      .select()
      .from(readers)
      .where(inArray(readers.id, ids))

    return directRows.map(mapRow)
  }

  private buildListFilter(params: ReaderListParams): SQL | undefined {
    const conditions: SQL[] = []
    if (params.role && params.role !== 'all') {
      conditions.push(eq(readers.role, params.role))
    }
    const search = params.search?.trim()
    if (search) {
      const pattern = `%${search}%`
      const searchClause = or(
        ilike(readers.name, pattern),
        ilike(readers.email, pattern),
        ilike(readers.handle, pattern),
        ilike(readers.username, pattern),
      )
      if (searchClause) conditions.push(searchClause)
    }
    if (conditions.length === 0) return undefined
    return conditions.length === 1 ? conditions[0] : and(...conditions)
  }

  async list(
    params: ReaderListParams = {},
  ): Promise<PaginationResult<ReaderRow>> {
    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(100, Math.max(1, params.size ?? 20))
    const offset = (page - 1) * size
    const where = this.buildListFilter(params)
    const lastLoginAt = sql<Date | null>`max(${sessions.createdAt})`
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({
          ...readerSelection,
          lastLoginAt,
        })
        .from(readers)
        .leftJoin(sessions, eq(sessions.userId, readers.id))
        .where(where)
        .groupBy(readers.id)
        .orderBy(
          sql`${lastLoginAt} desc nulls last`,
          desc(readers.createdAt),
          asc(readers.id),
        )
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(readers)
        .where(where),
    ])
    return {
      data: rows.map((row) => ({
        ...mapRow(row),
        lastLoginAt: row.lastLoginAt,
      })),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async findByIdDetailed(id: string): Promise<ReaderRow | null> {
    const lastLoginAt = sql<Date | null>`max(${sessions.createdAt})`
    const [row] = await this.db
      .select({
        ...readerSelection,
        lastLoginAt,
      })
      .from(readers)
      .leftJoin(sessions, eq(sessions.userId, readers.id))
      .where(eq(readers.id, id))
      .groupBy(readers.id)
      .limit(1)
    return row ? { ...mapRow(row), lastLoginAt: row.lastLoginAt } : null
  }

  async setBanned(
    id: string,
    payload: { bannedAt: Date; banReason: string | null },
  ): Promise<ReaderRow | null> {
    const [row] = await this.db
      .update(readers)
      .set({
        bannedAt: payload.bannedAt,
        banReason: payload.banReason,
        updatedAt: new Date(),
      })
      .where(eq(readers.id, id))
      .returning()
    return row ? mapRow(row) : null
  }

  async unsetBanned(id: string): Promise<ReaderRow | null> {
    const [row] = await this.db
      .update(readers)
      .set({ bannedAt: null, banReason: null, updatedAt: new Date() })
      .where(eq(readers.id, id))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId))
  }

  async countByRole(): Promise<ReaderRoleCounts> {
    const [row] = await this.db
      .select({
        all: sql<number>`count(*)::int`,
        owner: sql<number>`count(*) filter (where ${eq(readers.role, 'owner')})::int`,
        reader: sql<number>`count(*) filter (where ${eq(readers.role, 'reader')})::int`,
        banned: sql<number>`count(*) filter (where ${isNotNull(readers.bannedAt)})::int`,
      })
      .from(readers)
    return {
      all: Number(row?.all ?? 0),
      owner: Number(row?.owner ?? 0),
      reader: Number(row?.reader ?? 0),
      banned: Number(row?.banned ?? 0),
    }
  }

  async create(input: {
    id: string
    email?: string | null
    emailVerified?: boolean
    name?: string | null
    handle?: string | null
    username?: string | null
    displayUsername?: string | null
    image?: string | null
    role?: string
  }): Promise<ReaderRow> {
    const [row] = await this.db
      .insert(readers)
      .values({
        id: input.id,
        email: input.email ?? null,
        emailVerified: input.emailVerified ?? false,
        name: input.name ?? null,
        handle: input.handle ?? null,
        username: input.username ?? null,
        displayUsername: input.displayUsername ?? null,
        image: input.image ?? null,
        role: input.role ?? 'reader',
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: string,
    patch: Partial<Omit<ReaderRow, 'id' | 'createdAt'>>,
  ): Promise<ReaderRow | null> {
    const update: Partial<typeof readers.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (patch.email !== undefined) update.email = patch.email
    if (patch.emailVerified !== undefined)
      update.emailVerified = patch.emailVerified
    if (patch.name !== undefined) update.name = patch.name
    if (patch.handle !== undefined) update.handle = patch.handle
    if (patch.username !== undefined) update.username = patch.username
    if (patch.displayUsername !== undefined)
      update.displayUsername = patch.displayUsername
    if (patch.image !== undefined) update.image = patch.image
    if (patch.role !== undefined) update.role = patch.role
    const [row] = await this.db
      .update(readers)
      .set(update)
      .where(eq(readers.id, id))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteById(id: string): Promise<ReaderRow | null> {
    const [row] = await this.db
      .delete(readers)
      .where(eq(readers.id, id))
      .returning()
    return row ? mapRow(row) : null
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(readers)
    return Number(row?.count ?? 0)
  }
}
