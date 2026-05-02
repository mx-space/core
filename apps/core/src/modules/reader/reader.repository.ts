import { Inject, Injectable } from '@nestjs/common'
import { asc, eq, inArray, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { readers } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'

export interface ReaderRow {
  id: string
  email: string | null
  emailVerified: boolean
  name: string | null
  handle: string | null
  username: string | null
  displayUsername: string | null
  image: string | null
  role: string
  createdAt: Date
  updatedAt: Date | null
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
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

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

  async findOwner(): Promise<ReaderRow | null> {
    const [row] = await this.db
      .select()
      .from(readers)
      .where(eq(readers.role, 'owner'))
      .orderBy(asc(readers.createdAt), asc(readers.id))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByIds(ids: string[]): Promise<ReaderRow[]> {
    if (ids.length === 0) return []
    const rows = await this.db
      .select()
      .from(readers)
      .where(inArray(readers.id, ids))
    return rows.map(mapRow)
  }

  async list(page = 1, size = 20): Promise<PaginationResult<ReaderRow>> {
    page = Math.max(1, page)
    size = Math.min(100, Math.max(1, size))
    const offset = (page - 1) * size
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(readers)
        .orderBy(asc(readers.createdAt), asc(readers.id))
        .limit(size)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(readers),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
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
