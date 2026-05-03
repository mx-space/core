import { Inject, Injectable } from '@nestjs/common'
import { and, asc, desc, eq, inArray, ne, or, sql } from 'drizzle-orm'

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
  secret: string | null
  enable: boolean
  builtIn: boolean
  compiledCode: string | null
  createdAt: Date
  updatedAt: Date | null
}

export interface SnippetGroupRow {
  reference: string
  count: number
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
  secret: row.secret,
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

  async findPublicByName(
    name: string,
    reference: string,
  ): Promise<SnippetRow | null> {
    const [row] = await this.db
      .select()
      .from(snippets)
      .where(
        and(
          eq(snippets.name, name),
          eq(snippets.reference, reference),
          ne(snippets.type, 'function'),
        )!,
      )
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findFunctionByCustomPath(
    path: string,
    method: string,
  ): Promise<SnippetRow | null> {
    const [row] = await this.db
      .select()
      .from(snippets)
      .where(
        and(
          eq(snippets.customPath, path),
          eq(snippets.type, 'function'),
          or(eq(snippets.method, 'ALL'), eq(snippets.method, method))!,
        )!,
      )
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findFunctionByCustomPathPrefix(
    candidatePaths: string[],
    method: string,
  ): Promise<SnippetRow | null> {
    if (candidatePaths.length === 0) return null
    const rows = await this.db
      .select()
      .from(snippets)
      .where(
        and(
          inArray(snippets.customPath, candidatePaths),
          eq(snippets.type, 'function'),
          or(eq(snippets.method, 'ALL'), eq(snippets.method, method))!,
        )!,
      )
    if (rows.length === 0) return null
    const longest = rows.reduce((a, b) =>
      (a.customPath?.length ?? 0) >= (b.customPath?.length ?? 0) ? a : b,
    )
    return mapRow(longest)
  }

  async countByNameReferenceMethod(
    name: string,
    reference: string,
    method: string | null | undefined,
  ): Promise<number> {
    const filter =
      method === undefined || method === null
        ? and(eq(snippets.name, name), eq(snippets.reference, reference))!
        : and(
            eq(snippets.name, name),
            eq(snippets.reference, reference),
            eq(snippets.method, method),
          )!
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(snippets)
      .where(filter)
    return Number(count ?? 0)
  }

  async countByCustomPath(
    customPath: string,
    excludeId?: EntityId | string,
  ): Promise<number> {
    const filter = excludeId
      ? and(
          eq(snippets.customPath, customPath),
          ne(snippets.id, parseEntityId(excludeId)),
        )!
      : eq(snippets.customPath, customPath)
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(snippets)
      .where(filter)
    return Number(count ?? 0)
  }

  async findFunctionByNameReference(
    name: string,
    reference: string,
    method?: string,
  ): Promise<SnippetRow | null> {
    const baseFilter = and(
      eq(snippets.name, name),
      eq(snippets.reference, reference),
      eq(snippets.type, 'function'),
    )!
    const filter = method
      ? and(
          baseFilter,
          or(eq(snippets.method, 'ALL'), eq(snippets.method, method))!,
        )!
      : baseFilter
    const [row] = await this.db.select().from(snippets).where(filter).limit(1)
    return row ? mapRow(row) : null
  }

  async findFunctionsByNamesReferences(
    names: string[],
    references: string[],
  ): Promise<SnippetRow[]> {
    if (names.length === 0 || references.length === 0) return []
    const rows = await this.db
      .select()
      .from(snippets)
      .where(
        and(
          inArray(snippets.name, names),
          inArray(snippets.reference, references),
          eq(snippets.type, 'function'),
        )!,
      )
    return rows.map(mapRow)
  }

  async updateByName(
    name: string,
    patch: Partial<typeof snippets.$inferInsert>,
  ): Promise<void> {
    await this.db
      .update(snippets)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(snippets.name, name))
  }

  async groupByReference(): Promise<SnippetGroupRow[]> {
    const rows = await this.db
      .select({
        reference: snippets.reference,
        count: sql<number>`count(*)::int`,
      })
      .from(snippets)
      .groupBy(snippets.reference)
      .orderBy(asc(snippets.reference))
    return rows.map((r) => ({
      reference: r.reference,
      count: Number(r.count ?? 0),
    }))
  }

  async list(page = 1, size = 20): Promise<PaginationResult<SnippetRow>> {
    page = Math.max(1, page)
    size = Math.min(100, Math.max(1, size))
    const offset = (page - 1) * size
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(snippets)
        .orderBy(asc(snippets.reference), desc(snippets.createdAt))
        .limit(size)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(snippets),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async listGrouped(
    page = 1,
    size = 30,
  ): Promise<PaginationResult<SnippetGroupRow>> {
    page = Math.max(1, page)
    size = Math.min(100, Math.max(1, size))
    const offset = (page - 1) * size
    const all = await this.groupByReference()
    const total = all.length
    const data = all.slice(offset, offset + size)
    return {
      data,
      pagination: this.paginationOf(total, page, size),
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
    secret?: string | null
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
        secret: input.secret ?? null,
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
