import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { drafts } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export type DraftRefType = 'posts' | 'notes' | 'pages'

export interface DraftHistoryEntry {
  version: number
  title: string
  text?: string
  contentFormat: string
  content?: string
  typeSpecificData?: string
  savedAt: string
  isFullSnapshot: boolean
  refVersion?: number
  baseVersion?: number
}

export interface DraftRow {
  id: EntityId
  refType: DraftRefType
  refId: EntityId | null
  title: string
  text: string
  content: string | null
  contentFormat: string
  images: unknown[] | null
  meta: Record<string, unknown> | null
  typeSpecificData: Record<string, unknown> | null
  history: DraftHistoryEntry[]
  version: number
  publishedVersion: number | null
  createdAt: Date
  updatedAt: Date | null
}

export interface DraftCreateInput {
  refType: DraftRefType
  refId?: EntityId | string | null
  contentFormat: string
  title?: string
  text?: string
  content?: string | null
  images?: unknown[] | null
  meta?: Record<string, unknown> | null
  typeSpecificData?: Record<string, unknown> | null
}

export type DraftPatchInput = Partial<DraftCreateInput> & {
  version?: number
  publishedVersion?: number | null
  history?: DraftHistoryEntry[]
}

const mapRow = (row: typeof drafts.$inferSelect): DraftRow => ({
  id: toEntityId(row.id) as EntityId,
  refType: row.refType as DraftRefType,
  refId: row.refId ? (toEntityId(row.refId) as EntityId) : null,
  title: row.title,
  text: row.text,
  content: row.content,
  contentFormat: row.contentFormat,
  images: row.images,
  meta: row.meta,
  typeSpecificData: row.typeSpecificData,
  history: (row.history ?? []) as DraftHistoryEntry[],
  version: row.version,
  publishedVersion: row.publishedVersion,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

@Injectable()
export class DraftRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async list(
    refType?: DraftRefType,
    page = 1,
    size = 10,
  ): Promise<PaginationResult<DraftRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const where = refType ? eq(drafts.refType, refType) : undefined
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(drafts)
        .where(where)
        .orderBy(desc(drafts.updatedAt), desc(drafts.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(drafts)
        .where(where),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async findById(id: EntityId | string): Promise<DraftRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(drafts)
      .where(eq(drafts.id, idBig))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByRef(
    refType: DraftRefType,
    refId: EntityId | string,
  ): Promise<DraftRow | null> {
    const [row] = await this.db
      .select()
      .from(drafts)
      .where(
        and(
          eq(drafts.refType, refType),
          eq(drafts.refId, parseEntityId(refId)),
        )!,
      )
      .limit(1)
    return row ? mapRow(row) : null
  }

  async create(input: DraftCreateInput): Promise<DraftRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(drafts)
      .values({
        id,
        refType: input.refType,
        refId: input.refId ? parseEntityId(input.refId) : null,
        title: input.title ?? '',
        text: input.text ?? '',
        content: input.content ?? null,
        contentFormat: input.contentFormat,
        images: input.images ?? null,
        meta: input.meta ?? null,
        typeSpecificData: input.typeSpecificData ?? null,
        history: [],
        version: 1,
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    patch: DraftPatchInput,
  ): Promise<DraftRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof drafts.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (patch.refType !== undefined) update.refType = patch.refType
    if (patch.refId !== undefined)
      update.refId = patch.refId ? parseEntityId(patch.refId) : null
    if (patch.title !== undefined) update.title = patch.title
    if (patch.text !== undefined) update.text = patch.text
    if (patch.content !== undefined) update.content = patch.content
    if (patch.contentFormat !== undefined)
      update.contentFormat = patch.contentFormat
    if (patch.images !== undefined) update.images = patch.images
    if (patch.meta !== undefined) update.meta = patch.meta
    if (patch.typeSpecificData !== undefined)
      update.typeSpecificData = patch.typeSpecificData
    if (patch.version !== undefined) update.version = patch.version
    if (patch.publishedVersion !== undefined)
      update.publishedVersion = patch.publishedVersion
    if (patch.history !== undefined)
      update.history = patch.history as unknown as null
    const [row] = await this.db
      .update(drafts)
      .set(update)
      .where(eq(drafts.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async appendHistoryAndBumpVersion(
    id: EntityId | string,
    entry: DraftHistoryEntry,
    nextVersion: number,
  ): Promise<DraftRow | null> {
    const idBig = parseEntityId(id)
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(drafts)
        .where(eq(drafts.id, idBig))
        .limit(1)
      if (!existing) return null
      const history = ((existing.history as DraftHistoryEntry[] | null) ??
        []) as DraftHistoryEntry[]
      history.push(entry)
      const [row] = await tx
        .update(drafts)
        .set({
          history: history as unknown as null,
          version: nextVersion,
          updatedAt: new Date(),
        })
        .where(eq(drafts.id, idBig))
        .returning()
      return row ? mapRow(row) : null
    })
  }

  async deleteById(id: EntityId | string): Promise<DraftRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(drafts)
      .where(eq(drafts.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }
}
