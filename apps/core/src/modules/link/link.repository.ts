import { Inject, Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { links } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export enum LinkType {
  Friend = 0,
  Collection = 1,
}

export enum LinkState {
  Pass = 0,
  Audit = 1,
  Outdate = 2,
  Banned = 3,
  Reject = 4,
}

export interface LinkRow {
  id: EntityId
  name: string
  url: string
  avatar: string | null
  description: string | null
  type: LinkType
  state: LinkState
  email: string | null
  hide: boolean
  createdAt: Date
}

export interface LinkCreateInput {
  name: string
  url: string
  avatar?: string | null
  description?: string | null
  type?: LinkType
  state?: LinkState
  email?: string | null
}

export type LinkPatchInput = Partial<LinkCreateInput>

const mapRow = (row: typeof links.$inferSelect): LinkRow => ({
  id: toEntityId(row.id) as EntityId,
  name: row.name,
  url: row.url,
  avatar: row.avatar,
  description: row.description,
  type: (row.type ?? LinkType.Friend) as LinkType,
  state: (row.state ?? LinkState.Pass) as LinkState,
  email: row.email,
  hide: (row.state ?? LinkState.Pass) === LinkState.Audit,
  createdAt: row.createdAt,
})

@Injectable()
export class LinkRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findAll(): Promise<LinkRow[]> {
    const rows = await this.db.select().from(links).orderBy(links.createdAt)
    return rows.map(mapRow)
  }

  async findByState(state: LinkState): Promise<LinkRow[]> {
    const rows = await this.db
      .select()
      .from(links)
      .where(eq(links.state, state))
      .orderBy(links.createdAt)
    return rows.map(mapRow)
  }

  async findById(id: EntityId | string): Promise<LinkRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(links)
      .where(eq(links.id, idBig))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async create(input: LinkCreateInput): Promise<LinkRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(links)
      .values({
        id,
        name: input.name,
        url: input.url,
        avatar: input.avatar ?? null,
        description: input.description ?? null,
        type: input.type ?? LinkType.Friend,
        state: input.state ?? LinkState.Pass,
        email: input.email ?? null,
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    patch: LinkPatchInput,
  ): Promise<LinkRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof links.$inferInsert> = {}
    if (patch.name !== undefined) update.name = patch.name
    if (patch.url !== undefined) update.url = patch.url
    if (patch.avatar !== undefined) update.avatar = patch.avatar
    if (patch.description !== undefined) update.description = patch.description
    if (patch.type !== undefined) update.type = patch.type
    if (patch.state !== undefined) update.state = patch.state
    if (patch.email !== undefined) update.email = patch.email
    const [row] = await this.db
      .update(links)
      .set(update)
      .where(eq(links.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteById(id: EntityId | string): Promise<LinkRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(links)
      .where(eq(links.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(links)
    return Number(row?.count ?? 0)
  }
}
