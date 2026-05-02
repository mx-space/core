import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, type SQL, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { snippets } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface SnippetRow {
  id: EntityId
  type: string | null
  private: boolean
  raw: string
  name: string
  reference: string
  comment: string | null
  metatype: string | null
  schema: string | null
  method: string | null
  customPath: string | null
  enable: boolean
  builtIn: boolean
  compiledCode: string | null
  createdAt: Date
  updatedAt: Date | null
}

const mapRow = (row: typeof snippets.$inferSelect): SnippetRow => ({
  id: toEntityId(row.id) as EntityId,
  type: row.type,
  private: row.private,
  raw: row.raw,
  name: row.name,
  reference: row.reference,
  comment: row.comment,
  metatype: row.metatype,
  schema: row.schema,
  method: row.method,
  customPath: row.customPath,
  enable: row.enable,
  builtIn: row.builtIn,
  compiledCode: row.compiledCode,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

@Injectable()
export class SnippetRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findAll(reference?: string): Promise<SnippetRow[]> {
    const where = reference ? eq(snippets.reference, reference) : undefined
    const rows = await this.db
      .select()
      .from(snippets)
      .where(where)
      .orderBy(desc(snippets.createdAt))
    return rows.map(mapRow)
  }

  async findById(id: EntityId | string): Promise<SnippetRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(snippets)
      .where(eq(snippets.id, idBig))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByNameAndReference(
    name: string,
    reference: string,
  ): Promise<SnippetRow | null> {
    const [row] = await this.db
      .select()
      .from(snippets)
      .where(and(eq(snippets.name, name), eq(snippets.reference, reference))!)
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByCustomPath(path: string): Promise<SnippetRow | null> {
    const [row] = await this.db
      .select()
      .from(snippets)
      .where(eq(snippets.customPath, path))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async list(
    params: {
      page?: number
      size?: number
      type?: string
      reference?: string
    } = {},
  ): Promise<PaginationResult<SnippetRow>> {
    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(100, Math.max(1, params.size ?? 20))
    const offset = (page - 1) * size
    const filters: SQL[] = []
    if (params.type) filters.push(eq(snippets.type, params.type))
    if (params.reference) filters.push(eq(snippets.reference, params.reference))
    const where = filters.length > 0 ? and(...filters) : undefined
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(snippets)
        .where(where)
        .orderBy(desc(snippets.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(snippets)
        .where(where),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async create(input: {
    type?: string | null
    private?: boolean
    raw: string
    name: string
    reference?: string
    comment?: string | null
    metatype?: string | null
    schema?: string | null
    method?: string | null
    customPath?: string | null
    enable?: boolean
    builtIn?: boolean
    compiledCode?: string | null
  }): Promise<SnippetRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(snippets)
      .values({
        id,
        type: input.type ?? null,
        private: input.private ?? false,
        raw: input.raw,
        name: input.name,
        reference: input.reference ?? 'root',
        comment: input.comment ?? null,
        metatype: input.metatype ?? null,
        schema: input.schema ?? null,
        method: input.method ?? null,
        customPath: input.customPath ?? null,
        enable: input.enable ?? true,
        builtIn: input.builtIn ?? false,
        compiledCode: input.compiledCode ?? null,
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    patch: Partial<typeof snippets.$inferInsert>,
  ): Promise<SnippetRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .update(snippets)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(snippets.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteById(id: EntityId | string): Promise<SnippetRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(snippets)
      .where(eq(snippets.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }
}
