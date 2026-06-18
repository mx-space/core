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

import { SnippetType } from './snippet.schema'
import type { SnippetRow } from './snippet.types'

const mapRow = (row: typeof snippets.$inferSelect): SnippetRow => ({
  id: toEntityId(row.id) as EntityId,
  type: row.type,
  private: row.private,
  raw: row.raw,
  path: row.path,
  comment: row.comment,
  metatype: row.metatype,
  schema: row.schema,
  method: row.method,
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

  async findById(id: EntityId | string): Promise<SnippetRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(snippets)
      .where(eq(snippets.id, idBig))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByPath(path: string): Promise<SnippetRow | null> {
    const [row] = await this.db
      .select()
      .from(snippets)
      .where(and(eq(snippets.path, path), ne(snippets.type, 'function'))!)
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findAnyByPath(
    path: string,
    method?: string | null,
  ): Promise<SnippetRow | null> {
    const filter = method
      ? and(eq(snippets.path, path), eq(snippets.method, method))!
      : eq(snippets.path, path)
    const [row] = await this.db.select().from(snippets).where(filter).limit(1)
    return row ? mapRow(row) : null
  }

  async findFunctionByPath(
    path: string,
    method: string,
  ): Promise<SnippetRow | null> {
    const [row] = await this.db
      .select()
      .from(snippets)
      .where(
        and(
          eq(snippets.path, path),
          eq(snippets.type, 'function'),
          or(eq(snippets.method, 'ALL'), eq(snippets.method, method))!,
        )!,
      )
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findFunctionByPathPrefix(
    candidatePaths: string[],
    method: string,
  ): Promise<SnippetRow | null> {
    if (candidatePaths.length === 0) return null
    const rows = await this.db
      .select()
      .from(snippets)
      .where(
        and(
          inArray(snippets.path, candidatePaths),
          eq(snippets.type, 'function'),
          or(eq(snippets.method, 'ALL'), eq(snippets.method, method))!,
        )!,
      )
    if (rows.length === 0) return null
    const longest = rows.reduce((a, b) =>
      a.path.length >= b.path.length ? a : b,
    )
    return mapRow(longest)
  }

  async findFunctionsByPaths(paths: string[]): Promise<SnippetRow[]> {
    if (paths.length === 0) return []
    const rows = await this.db
      .select()
      .from(snippets)
      .where(and(inArray(snippets.path, paths), eq(snippets.type, 'function'))!)
    return rows.map(mapRow)
  }

  async countByPathMethod(
    path: string,
    method: string | null | undefined,
    excludeId?: EntityId | string,
  ): Promise<number> {
    const filters = [eq(snippets.path, path)]
    if (method == null) {
      filters.push(sql`${snippets.method} is null` as any)
    } else {
      filters.push(eq(snippets.method, method))
    }
    if (excludeId) {
      filters.push(ne(snippets.id, parseEntityId(excludeId)))
    }

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(snippets)
      .where(and(...filters)!)
    return Number(count ?? 0)
  }

  async list(
    page = 1,
    size = 20,
    type?: SnippetType,
  ): Promise<PaginationResult<SnippetRow>> {
    page = Math.max(1, page)
    size = Math.min(100, Math.max(1, size))
    const offset = (page - 1) * size
    const where = type ? eq(snippets.type, type) : undefined
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(snippets)
        .where(where)
        .orderBy(asc(snippets.path), desc(snippets.createdAt))
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

  async findByPrefix(prefix: string, limit = 1000): Promise<SnippetRow[]> {
    const normalizedLimit = Math.min(1000, Math.max(1, limit))
    const filter = prefix
      ? sql`${snippets.path} like ${`${prefix}%`}`
      : undefined
    const rows = await this.db
      .select()
      .from(snippets)
      .where(filter)
      .orderBy(asc(snippets.path), asc(snippets.method))
      .limit(normalizedLimit)
    return rows.map(mapRow)
  }

  async create(input: {
    type?: string | null
    private?: boolean
    raw: string
    path: string
    comment?: string | null
    metatype?: string | null
    schema?: string | null
    method?: string | null
    secret?: string | null
    enable?: boolean
    builtIn?: boolean
    compiledCode?: string | null
  }): Promise<SnippetRow> {
    const id = this.snowflake.nextId()
    const [row] = await this.db
      .insert(snippets)
      .values({
        id,
        type: input.type ?? null,
        private: input.private ?? false,
        raw: input.raw,
        path: input.path,
        comment: input.comment ?? null,
        metatype: input.metatype ?? null,
        schema: input.schema ?? null,
        method: input.method ?? null,
        secret: input.secret ?? null,
        enable: input.enable ?? true,
        builtIn: input.builtIn ?? false,
        compiledCode: input.compiledCode ?? null,
      })
      .returning()
    return mapRow(row)
  }

  async upsertByPath(
    input: Parameters<SnippetRepository['create']>[0],
  ): Promise<SnippetRow> {
    const existing = await this.findAnyByPath(input.path, input.method ?? null)
    if (!existing) return this.create(input)

    const updated = await this.update(existing.id, input)
    return updated ?? existing
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

  async updateByPath(
    path: string,
    patch: Partial<typeof snippets.$inferInsert>,
  ): Promise<void> {
    await this.db
      .update(snippets)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(snippets.path, path))
  }

  async deleteById(id: EntityId | string): Promise<SnippetRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(snippets)
      .where(eq(snippets.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteByPath(path: string, recursive: boolean): Promise<SnippetRow[]> {
    const filter = recursive
      ? sql`${snippets.path} like ${`${path}%`}`
      : eq(snippets.path, path)
    const rows = await this.db.delete(snippets).where(filter).returning()
    return rows.map(mapRow)
  }

  async movePath(
    from: string,
    to: string,
    recursive: boolean,
  ): Promise<SnippetRow[]> {
    if (!recursive) {
      const row = await this.findAnyByPath(from)
      if (!row) return []
      const updated = await this.update(row.id, { path: to })
      return updated ? [updated] : []
    }

    const rows = await this.findByPrefix(from, 1000)
    if (rows.length === 0) return []
    return this.db.transaction(async (tx) => {
      const moved: SnippetRow[] = []
      for (const row of rows) {
        const nextPath = `${to}${row.path.slice(from.length)}`
        const [updated] = await tx
          .update(snippets)
          .set({ path: nextPath, updatedAt: new Date() })
          .where(eq(snippets.id, parseEntityId(row.id)))
          .returning()
        if (updated) moved.push(mapRow(updated))
      }
      return moved
    })
  }

  async findSkillsByIds(
    ids: string[],
    includePrivate: boolean,
  ): Promise<SnippetRow[]> {
    if (ids.length === 0) return []
    const bigIds = ids.map((id) => parseEntityId(id))
    const filters = [
      inArray(snippets.id, bigIds),
      eq(snippets.type, SnippetType.Skill),
      sql`${snippets.path} like ${'%/SKILL.md'}`,
    ]
    if (!includePrivate) filters.push(eq(snippets.private, false))

    const rows = await this.db
      .select()
      .from(snippets)
      .where(and(...filters)!)
    return rows.map(mapRow)
  }
}
