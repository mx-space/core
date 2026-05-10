import { Inject, Injectable } from '@nestjs/common'
import {
  and,
  arrayOverlaps,
  desc,
  eq,
  ilike,
  inArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { searchDocuments } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type {
  SearchDocumentRefType,
  SearchDocumentRow,
  SearchDocumentUpsertInput,
} from './search-document.types'

const mapRow = (
  row: typeof searchDocuments.$inferSelect,
): SearchDocumentRow => ({
  id: toEntityId(row.id) as string,
  refType: row.refType as SearchDocumentRefType,
  refId: toEntityId(row.refId) as string,
  lang: row.lang,
  sourceHash: row.sourceHash ?? '',
  title: row.title,
  searchText: row.searchText,
  terms: row.terms ?? [],
  titleTermFreq: row.titleTermFreq ?? {},
  bodyTermFreq: row.bodyTermFreq ?? {},
  titleLength: row.titleLength,
  bodyLength: row.bodyLength,
  slug: row.slug,
  nid: row.nid,
  isPublished: row.isPublished,
  publicAt: row.publicAt,
  hasPassword: row.hasPassword,
  createdAt: row.createdAt,
  modifiedAt: row.modifiedAt,
})

const visibilityFilters = (refType?: SearchDocumentRefType): SQL[] => {
  // page rows have no visibility gate (mirrors legacy isVisible behaviour).
  if (refType === 'page') return []
  return [
    eq(searchDocuments.isPublished, true),
    eq(searchDocuments.hasPassword, false),
    sql`(${searchDocuments.publicAt} is null or ${searchDocuments.publicAt} <= now())`,
  ]
}

@Injectable()
export class SearchRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findByRef(
    refType: SearchDocumentRefType,
    refId: EntityId | string,
    lang: string,
  ): Promise<SearchDocumentRow | null> {
    const refBig = parseEntityId(refId)
    const [row] = await this.db
      .select()
      .from(searchDocuments)
      .where(
        and(
          eq(searchDocuments.refType, refType),
          eq(searchDocuments.refId, refBig),
          eq(searchDocuments.lang, lang),
        )!,
      )
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByIds(ids: Array<EntityId | string>): Promise<SearchDocumentRow[]> {
    if (ids.length === 0) return []
    const bigIds = ids.map((id) => parseEntityId(id))
    const rows = await this.db
      .select()
      .from(searchDocuments)
      .where(inArray(searchDocuments.id, bigIds))
    return rows.map(mapRow)
  }

  async findAll(
    refType?: SearchDocumentRefType,
    lang?: string,
  ): Promise<SearchDocumentRow[]> {
    const filters: SQL[] = []
    if (refType) filters.push(eq(searchDocuments.refType, refType))
    if (lang) filters.push(eq(searchDocuments.lang, lang))
    const where = filters.length ? and(...filters) : undefined
    const rows = await this.db
      .select()
      .from(searchDocuments)
      .where(where)
      .orderBy(
        desc(searchDocuments.modifiedAt),
        desc(searchDocuments.createdAt),
      )
    return rows.map(mapRow)
  }

  /**
   * List visible documents (published, public time elapsed, not password
   * gated). Mirrors the legacy filter precisely.
   */
  async listVisible(
    refType?: SearchDocumentRefType,
    page = 1,
    size = 20,
    lang?: string,
  ): Promise<PaginationResult<SearchDocumentRow>> {
    page = Math.max(1, page)
    size = Math.min(100, Math.max(1, size))
    const offset = (page - 1) * size
    const filters: SQL[] = [...visibilityFilters(refType)]
    if (refType) filters.push(eq(searchDocuments.refType, refType))
    if (lang) filters.push(eq(searchDocuments.lang, lang))
    const where = filters.length ? and(...filters) : undefined
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(searchDocuments)
        .where(where)
        .orderBy(
          desc(searchDocuments.modifiedAt),
          desc(searchDocuments.createdAt),
        )
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(searchDocuments)
        .where(where),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  /**
   * Find documents that contain any of the supplied terms in their tokenized
   * `terms` array. Used by the BM25-scoring algorithm in SearchService.
   */
  async findByTerms(
    terms: string[],
    refType?: SearchDocumentRefType,
    lang?: string,
    limit = 100,
  ): Promise<SearchDocumentRow[]> {
    if (terms.length === 0) return []
    const filters: SQL[] = [arrayOverlaps(searchDocuments.terms, terms)]
    if (refType) filters.push(eq(searchDocuments.refType, refType))
    if (lang) filters.push(eq(searchDocuments.lang, lang))
    const rows = await this.db
      .select()
      .from(searchDocuments)
      .where(and(...filters))
      .limit(limit)
    return rows.map(mapRow)
  }

  async findByKeyword(
    keyword: string,
    refType?: SearchDocumentRefType,
    lang?: string,
    limit = 100,
  ): Promise<SearchDocumentRow[]> {
    if (!keyword.trim()) return []
    const pattern = `%${keyword.trim()}%`
    const filters: SQL[] = [
      or(
        ilike(searchDocuments.title, pattern),
        ilike(searchDocuments.searchText, pattern),
      )!,
    ]
    if (refType) filters.push(eq(searchDocuments.refType, refType))
    if (lang) filters.push(eq(searchDocuments.lang, lang))
    const rows = await this.db
      .select()
      .from(searchDocuments)
      .where(and(...filters))
      .limit(limit)
    return rows.map(mapRow)
  }

  async deleteAll(): Promise<number> {
    const result = await this.db
      .delete(searchDocuments)
      .returning({ id: searchDocuments.id })
    return result.length
  }

  /**
   * Insert or update a search document keyed on (ref_type, ref_id, lang).
   * Uses ON CONFLICT to avoid the select-then-update race.
   */
  async upsert(input: SearchDocumentUpsertInput): Promise<SearchDocumentRow> {
    const refBig = parseEntityId(input.refId)
    const id = input.id ? parseEntityId(input.id) : this.snowflake.nextId()
    const modifiedAt = input.modifiedAt ?? new Date()
    const [row] = await this.db
      .insert(searchDocuments)
      .values({
        id,
        refType: input.refType,
        refId: refBig,
        lang: input.lang,
        sourceHash: input.sourceHash ?? '',
        title: input.title,
        searchText: input.searchText,
        terms: input.terms,
        titleTermFreq: input.titleTermFreq,
        bodyTermFreq: input.bodyTermFreq,
        titleLength: input.titleLength,
        bodyLength: input.bodyLength,
        slug: input.slug,
        nid: input.nid,
        isPublished: input.isPublished,
        publicAt: input.publicAt,
        hasPassword: input.hasPassword,
        modifiedAt,
      })
      .onConflictDoUpdate({
        target: [
          searchDocuments.refType,
          searchDocuments.refId,
          searchDocuments.lang,
        ],
        set: {
          sourceHash: input.sourceHash ?? '',
          title: input.title,
          searchText: input.searchText,
          terms: input.terms,
          titleTermFreq: input.titleTermFreq,
          bodyTermFreq: input.bodyTermFreq,
          titleLength: input.titleLength,
          bodyLength: input.bodyLength,
          slug: input.slug,
          nid: input.nid,
          isPublished: input.isPublished,
          publicAt: input.publicAt,
          hasPassword: input.hasPassword,
          modifiedAt,
        },
      })
      .returning()
    return mapRow(row)
  }

  /**
   * Delete the index row for a (refType, refId, lang). When `lang` is
   * omitted, every language for the ref is dropped (used on article delete).
   */
  async deleteByRef(
    refType: SearchDocumentRefType,
    refId: EntityId | string,
    lang?: string,
  ): Promise<number> {
    const refBig = parseEntityId(refId)
    const filters: SQL[] = [
      eq(searchDocuments.refType, refType),
      eq(searchDocuments.refId, refBig),
    ]
    if (lang) filters.push(eq(searchDocuments.lang, lang))
    const result = await this.db
      .delete(searchDocuments)
      .where(and(...filters)!)
      .returning({ id: searchDocuments.id })
    return result.length
  }

  async count(refType?: SearchDocumentRefType): Promise<number> {
    const where = refType ? eq(searchDocuments.refType, refType) : undefined
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(searchDocuments)
      .where(where)
    return Number(row?.count ?? 0)
  }

  /**
   * Aggregate BM25 corpus stats for one language. The aggregate stays in the
   * DB so the rest of the search path doesn't pull every row into Node just
   * to compute three numbers.
   */
  async findCorpusStatsByLang(
    lang: string,
    refType: SearchDocumentRefType | undefined,
    options: { hasAdminAccess: boolean } = { hasAdminAccess: false },
  ): Promise<{
    totalDocs: number
    avgTitleLength: number
    avgBodyLength: number
  }> {
    const filters: SQL[] = [eq(searchDocuments.lang, lang)]
    if (refType) filters.push(eq(searchDocuments.refType, refType))
    if (!options.hasAdminAccess) {
      filters.push(...visibilityFilters(refType))
    }
    const where = and(...filters)
    const [row] = await this.db
      .select({
        totalDocs: sql<number>`count(*)::int`,
        avgTitleLength: sql<number>`coalesce(avg(${searchDocuments.titleLength})::float, 0)`,
        avgBodyLength: sql<number>`coalesce(avg(${searchDocuments.bodyLength})::float, 0)`,
      })
      .from(searchDocuments)
      .where(where)
    const totalDocs = Number(row?.totalDocs ?? 0)
    return {
      totalDocs,
      avgTitleLength: totalDocs ? Number(row?.avgTitleLength ?? 1) : 1,
      avgBodyLength: totalDocs ? Number(row?.avgBodyLength ?? 1) : 1,
    }
  }

  /**
   * Distribution of indexed lang per refType. Powers the admin overview page.
   */
  async countByLang(
    refType?: SearchDocumentRefType,
  ): Promise<Array<{ lang: string; count: number }>> {
    const where = refType ? eq(searchDocuments.refType, refType) : undefined
    const rows = await this.db
      .select({
        lang: searchDocuments.lang,
        count: sql<number>`count(*)::int`,
      })
      .from(searchDocuments)
      .where(where)
      .groupBy(searchDocuments.lang)
    return rows.map((r) => ({ lang: r.lang, count: Number(r.count ?? 0) }))
  }

  async countByRefType(): Promise<
    Array<{ refType: SearchDocumentRefType; count: number }>
  > {
    const rows = await this.db
      .select({
        refType: searchDocuments.refType,
        count: sql<number>`count(*)::int`,
      })
      .from(searchDocuments)
      .groupBy(searchDocuments.refType)
    return rows.map((r) => ({
      refType: r.refType as SearchDocumentRefType,
      count: Number(r.count ?? 0),
    }))
  }

  /**
   * Bulk lookup of (refType, refId, lang) -> sourceHash for the rebuild diff.
   * Returns a Map keyed by `${refType}:${refId}:${lang}`.
   */
  async findHashesByRefMap(): Promise<Map<string, string>> {
    const rows = await this.db
      .select({
        refType: searchDocuments.refType,
        refId: searchDocuments.refId,
        lang: searchDocuments.lang,
        sourceHash: searchDocuments.sourceHash,
      })
      .from(searchDocuments)
    const map = new Map<string, string>()
    for (const row of rows) {
      const refId = toEntityId(row.refId) as string
      map.set(`${row.refType}:${refId}:${row.lang}`, row.sourceHash ?? '')
    }
    return map
  }

  /**
   * Admin-facing paginated listing with optional filters.
   */
  async findAdminRows(query: {
    refType?: SearchDocumentRefType
    lang?: string
    keyword?: string
    page?: number
    size?: number
  }): Promise<PaginationResult<SearchDocumentRow>> {
    const page = Math.max(1, query.page ?? 1)
    const size = Math.min(100, Math.max(1, query.size ?? 20))
    const offset = (page - 1) * size
    const filters: SQL[] = []
    if (query.refType) filters.push(eq(searchDocuments.refType, query.refType))
    if (query.lang) filters.push(eq(searchDocuments.lang, query.lang))
    if (query.keyword?.trim()) {
      const pattern = `%${query.keyword.trim()}%`
      filters.push(
        or(
          ilike(searchDocuments.title, pattern),
          ilike(searchDocuments.searchText, pattern),
        )!,
      )
    }
    const where = filters.length ? and(...filters) : undefined
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(searchDocuments)
        .where(where)
        .orderBy(
          desc(searchDocuments.modifiedAt),
          desc(searchDocuments.createdAt),
        )
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(searchDocuments)
        .where(where),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }
}
