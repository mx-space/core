import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, inArray, type SQL, sql } from 'drizzle-orm'

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

export type SearchDocumentRefType = 'post' | 'note' | 'page'

export interface SearchDocumentRow {
  id: EntityId
  refType: SearchDocumentRefType
  refId: EntityId
  title: string
  searchText: string
  terms: string[]
  titleTermFreq: Record<string, number>
  bodyTermFreq: Record<string, number>
  titleLength: number
  bodyLength: number
  slug: string | null
  nid: number | null
  isPublished: boolean
  publicAt: Date | null
  hasPassword: boolean
  createdAt: Date
  modifiedAt: Date | null
}

const mapRow = (
  row: typeof searchDocuments.$inferSelect,
): SearchDocumentRow => ({
  id: toEntityId(row.id) as EntityId,
  refType: row.refType as SearchDocumentRefType,
  refId: toEntityId(row.refId) as EntityId,
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

export interface SearchDocumentUpsertInput extends Omit<
  SearchDocumentRow,
  'id' | 'createdAt'
> {
  id?: EntityId | string
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
  ): Promise<SearchDocumentRow | null> {
    const refBig = parseEntityId(refId)
    const [row] = await this.db
      .select()
      .from(searchDocuments)
      .where(
        and(
          eq(searchDocuments.refType, refType),
          eq(searchDocuments.refId, refBig),
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

  /**
   * List visible documents (published, public time elapsed, not password
   * gated). Mirrors the legacy filter precisely.
   */
  async listVisible(
    refType?: SearchDocumentRefType,
    page = 1,
    size = 20,
  ): Promise<PaginationResult<SearchDocumentRow>> {
    page = Math.max(1, page)
    size = Math.min(100, Math.max(1, size))
    const offset = (page - 1) * size
    const filters: SQL[] = [
      eq(searchDocuments.isPublished, true),
      eq(searchDocuments.hasPassword, false),
      sql`(${searchDocuments.publicAt} is null or ${searchDocuments.publicAt} <= now())`,
    ]
    if (refType) filters.push(eq(searchDocuments.refType, refType))
    const where = and(...filters)
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
  ): Promise<SearchDocumentRow[]> {
    if (terms.length === 0) return []
    const filters: SQL[] = [sql`${searchDocuments.terms} && ${terms}::text[]`]
    if (refType) filters.push(eq(searchDocuments.refType, refType))
    const rows = await this.db
      .select()
      .from(searchDocuments)
      .where(and(...filters))
    return rows.map(mapRow)
  }

  async upsert(input: SearchDocumentUpsertInput): Promise<SearchDocumentRow> {
    const refBig = parseEntityId(input.refId)
    const [existing] = await this.db
      .select()
      .from(searchDocuments)
      .where(
        and(
          eq(searchDocuments.refType, input.refType),
          eq(searchDocuments.refId, refBig),
        )!,
      )
      .limit(1)
    if (existing) {
      const [row] = await this.db
        .update(searchDocuments)
        .set({
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
          modifiedAt: input.modifiedAt ?? new Date(),
        })
        .where(eq(searchDocuments.id, existing.id))
        .returning()
      return mapRow(row)
    }
    const id = input.id ? parseEntityId(input.id) : this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(searchDocuments)
      .values({
        id,
        refType: input.refType,
        refId: refBig,
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
        modifiedAt: input.modifiedAt,
      })
      .returning()
    return mapRow(row)
  }

  async deleteByRef(
    refType: SearchDocumentRefType,
    refId: EntityId | string,
  ): Promise<boolean> {
    const refBig = parseEntityId(refId)
    const result = await this.db
      .delete(searchDocuments)
      .where(
        and(
          eq(searchDocuments.refType, refType),
          eq(searchDocuments.refId, refBig),
        )!,
      )
      .returning({ id: searchDocuments.id })
    return result.length > 0
  }

  async count(refType?: SearchDocumentRefType): Promise<number> {
    const where = refType ? eq(searchDocuments.refType, refType) : undefined
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(searchDocuments)
      .where(where)
    return Number(row?.count ?? 0)
  }
}
