import { Inject, Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { ownerProfiles, readers } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface ReaderRow {
  id: EntityId
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
  id: toEntityId(row.id) as EntityId,
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
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findById(id: EntityId | string): Promise<ReaderRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(readers)
      .where(eq(readers.id, idBig))
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
      .limit(1)
    return row ? mapRow(row) : null
  }

  async create(input: {
    email?: string | null
    name?: string | null
    username?: string | null
    role?: string
  }): Promise<ReaderRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(readers)
      .values({
        id,
        email: input.email ?? null,
        emailVerified: false,
        name: input.name ?? null,
        username: input.username ?? null,
        role: input.role ?? 'reader',
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    patch: Partial<Omit<ReaderRow, 'id' | 'createdAt'>>,
  ): Promise<ReaderRow | null> {
    const idBig = parseEntityId(id)
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
      .where(eq(readers.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteById(id: EntityId | string): Promise<ReaderRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(readers)
      .where(eq(readers.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async upsertOwnerProfile(
    readerId: EntityId | string,
    patch: Partial<{
      mail: string | null
      url: string | null
      introduce: string | null
      lastLoginIp: string | null
      lastLoginTime: Date | null
      socialIds: Record<string, unknown> | null
    }>,
  ): Promise<void> {
    const readerBig = parseEntityId(readerId)
    const [existing] = await this.db
      .select()
      .from(ownerProfiles)
      .where(eq(ownerProfiles.readerId, readerBig))
      .limit(1)
    if (existing) {
      await this.db
        .update(ownerProfiles)
        .set({
          mail: patch.mail ?? existing.mail,
          url: patch.url ?? existing.url,
          introduce: patch.introduce ?? existing.introduce,
          lastLoginIp: patch.lastLoginIp ?? existing.lastLoginIp,
          lastLoginTime: patch.lastLoginTime ?? existing.lastLoginTime,
          socialIds: patch.socialIds ?? existing.socialIds,
        })
        .where(eq(ownerProfiles.readerId, readerBig))
      return
    }
    await this.db.insert(ownerProfiles).values({
      id: this.snowflake.nextBigInt(),
      readerId: readerBig,
      mail: patch.mail ?? null,
      url: patch.url ?? null,
      introduce: patch.introduce ?? null,
      lastLoginIp: patch.lastLoginIp ?? null,
      lastLoginTime: patch.lastLoginTime ?? null,
      socialIds: patch.socialIds ?? null,
    })
  }

  async getOwnerProfile(readerId: EntityId | string) {
    const readerBig = parseEntityId(readerId)
    const [row] = await this.db
      .select()
      .from(ownerProfiles)
      .where(eq(ownerProfiles.readerId, readerBig))
      .limit(1)
    if (!row) return null
    return {
      id: toEntityId(row.id) as EntityId,
      readerId: toEntityId(row.readerId) as EntityId,
      mail: row.mail,
      url: row.url,
      introduce: row.introduce,
      lastLoginIp: row.lastLoginIp,
      lastLoginTime: row.lastLoginTime,
      socialIds: row.socialIds,
      createdAt: row.createdAt,
    }
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(readers)
    return Number(row?.count ?? 0)
  }
}
