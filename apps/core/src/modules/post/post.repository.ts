import { Inject, Injectable } from '@nestjs/common'
import { and, asc, desc, eq, ilike, inArray, type SQL, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { categories, postRelatedPosts, posts } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface PostRow {
  id: EntityId
  title: string
  slug: string
  text: string
  content: string | null
  contentFormat: string
  summary: string | null
  images: unknown[] | null
  meta: Record<string, unknown> | null
  tags: string[]
  modifiedAt: Date | null
  categoryId: EntityId
  category?: {
    id: EntityId
    name: string
    slug: string
    type: number
  }
  copyright: boolean
  isPublished: boolean
  readCount: number
  likeCount: number
  pinAt: Date | null
  pinOrder: number | null
  createdAt: Date
}

export interface PostCreateInput {
  title: string
  slug: string
  contentFormat: string
  createdAt?: Date
  text?: string | null
  content?: string | null
  summary?: string | null
  images?: unknown[] | null
  meta?: Record<string, unknown> | null
  tags?: string[]
  categoryId: EntityId | string
  copyright?: boolean
  isPublished?: boolean
  pinAt?: Date | null
  pinOrder?: number | null
}

export type PostPatchInput = Partial<Omit<PostCreateInput, 'categoryId'>> & {
  categoryId?: EntityId | string
  modifiedAt?: Date | null
}

export interface PostListParams {
  page?: number
  size?: number
  categoryId?: EntityId | string
  categoryIds?: Array<EntityId | string>
  tag?: string
  publishedOnly?: boolean
  year?: number
  sortBy?: keyof PostRow
  sortOrder?: 1 | -1
}

export interface PostTagCount {
  [key: string]: unknown
  name: string
  count: number
}

export interface PostListByCategoryOptions {
  includeCategory?: boolean
  limit?: number
  publishedOnly?: boolean
}

const mapBase = (row: typeof posts.$inferSelect): PostRow => ({
  id: toEntityId(row.id) as EntityId,
  title: row.title,
  slug: row.slug,
  text: row.text ?? '',
  content: row.content,
  contentFormat: row.contentFormat,
  summary: row.summary,
  images: row.images,
  meta: row.meta,
  tags: row.tags ?? [],
  modifiedAt: row.modifiedAt,
  categoryId: toEntityId(row.categoryId) as EntityId,
  copyright: row.copyright,
  isPublished: row.isPublished,
  readCount: row.readCount,
  likeCount: row.likeCount,
  pinAt: row.pinAt,
  pinOrder: row.pinOrder,
  createdAt: row.createdAt,
})

const pinAtDescNullsLast = sql`${posts.pinAt} desc nulls last`

@Injectable()
export class PostRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findById(id: EntityId | string): Promise<PostRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(posts)
      .where(eq(posts.id, idBig))
      .limit(1)
    if (!row) return null
    return this.attachCategory(mapBase(row))
  }

  async findBySlug(slug: string): Promise<PostRow | null> {
    const [row] = await this.db
      .select()
      .from(posts)
      .where(eq(posts.slug, slug))
      .limit(1)
    if (!row) return null
    return this.attachCategory(mapBase(row))
  }

  async findByCategory(categoryId: EntityId | string): Promise<PostRow[]> {
    const idBig = parseEntityId(categoryId)
    const rows = await this.db
      .select()
      .from(posts)
      .where(eq(posts.categoryId, idBig))
      .orderBy(pinAtDescNullsLast, desc(posts.createdAt))
    return Promise.all(rows.map((r) => this.attachCategory(mapBase(r))))
  }

  async list(params: PostListParams = {}): Promise<PaginationResult<PostRow>> {
    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(50, Math.max(1, params.size ?? 10))
    const offset = (page - 1) * size
    const filters: SQL[] = []
    if (params.categoryId) {
      filters.push(eq(posts.categoryId, parseEntityId(params.categoryId)))
    }
    if (params.categoryIds?.length) {
      filters.push(
        inArray(
          posts.categoryId,
          params.categoryIds.map((id) => parseEntityId(id)),
        ),
      )
    }
    if (params.publishedOnly) {
      filters.push(eq(posts.isPublished, true))
    }
    if (params.tag) {
      filters.push(sql`${posts.tags} @> array[${params.tag}]::text[]`)
    }
    if (params.year) {
      filters.push(
        sql`extract(year from ${posts.createdAt})::int = ${params.year}`,
      )
    }
    const whereClause = filters.length > 0 ? and(...filters) : undefined
    const orderBy =
      params.sortBy === 'createdAt'
        ? params.sortOrder === 1
          ? asc(posts.createdAt)
          : desc(posts.createdAt)
        : params.sortBy === 'modifiedAt'
          ? params.sortOrder === 1
            ? asc(posts.modifiedAt)
            : desc(posts.modifiedAt)
          : params.sortBy === 'pinAt'
            ? params.sortOrder === 1
              ? asc(posts.pinAt)
              : pinAtDescNullsLast
            : null

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(posts)
        .where(whereClause)
        .orderBy(orderBy ?? pinAtDescNullsLast, desc(posts.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(posts)
        .where(whereClause),
    ])

    const data = await Promise.all(
      rows.map((r) => this.attachCategory(mapBase(r))),
    )
    return {
      data,
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async create(input: PostCreateInput): Promise<PostRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(posts)
      .values({
        id,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
        title: input.title,
        slug: input.slug,
        text: input.text ?? null,
        content: input.content ?? null,
        contentFormat: input.contentFormat,
        summary: input.summary ?? null,
        images: input.images ?? null,
        meta: input.meta ?? null,
        tags: input.tags ?? [],
        categoryId: parseEntityId(input.categoryId),
        copyright: input.copyright ?? true,
        isPublished: input.isPublished ?? true,
        pinAt: input.pinAt ?? null,
        pinOrder: input.pinOrder ?? null,
      })
      .returning()
    return this.attachCategory(mapBase(row))
  }

  async update(
    id: EntityId | string,
    patch: PostPatchInput,
  ): Promise<PostRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof posts.$inferInsert> = {}
    if (patch.title !== undefined) update.title = patch.title
    if (patch.createdAt !== undefined) update.createdAt = patch.createdAt
    if (patch.slug !== undefined) update.slug = patch.slug
    if (patch.text !== undefined) update.text = patch.text
    if (patch.content !== undefined) update.content = patch.content
    if (patch.contentFormat !== undefined)
      update.contentFormat = patch.contentFormat
    if (patch.summary !== undefined) update.summary = patch.summary
    if (patch.images !== undefined) update.images = patch.images
    if (patch.meta !== undefined) update.meta = patch.meta
    if (patch.tags !== undefined) update.tags = patch.tags
    if (patch.categoryId !== undefined)
      update.categoryId = parseEntityId(patch.categoryId)
    if (patch.copyright !== undefined) update.copyright = patch.copyright
    if (patch.isPublished !== undefined) update.isPublished = patch.isPublished
    if (patch.pinAt !== undefined) update.pinAt = patch.pinAt
    if (patch.pinOrder !== undefined) update.pinOrder = patch.pinOrder
    update.modifiedAt = patch.modifiedAt ?? new Date()
    const [row] = await this.db
      .update(posts)
      .set(update)
      .where(eq(posts.id, idBig))
      .returning()
    return row ? this.attachCategory(mapBase(row)) : null
  }

  async deleteById(id: EntityId | string): Promise<PostRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(posts)
      .where(eq(posts.id, idBig))
      .returning()
    return row ? mapBase(row) : null
  }

  async incrementRead(id: EntityId | string, by = 1): Promise<void> {
    const idBig = parseEntityId(id)
    await this.db
      .update(posts)
      .set({ readCount: sql`${posts.readCount} + ${by}` })
      .where(eq(posts.id, idBig))
  }

  async incrementLike(id: EntityId | string, by = 1): Promise<void> {
    const idBig = parseEntityId(id)
    await this.db
      .update(posts)
      .set({ likeCount: sql`${posts.likeCount} + ${by}` })
      .where(eq(posts.id, idBig))
  }

  async countByCategory(categoryId: EntityId | string): Promise<number> {
    const idBig = parseEntityId(categoryId)
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(eq(posts.categoryId, idBig))
    return Number(row?.count ?? 0)
  }

  async countByCategoryId(categoryId: EntityId | string): Promise<number> {
    return this.countByCategory(categoryId)
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
    return Number(row?.count ?? 0)
  }

  async findRecent(
    size: number,
    options: { publishedOnly?: boolean } = {},
  ): Promise<PostRow[]> {
    const where = options.publishedOnly
      ? eq(posts.isPublished, true)
      : undefined
    const rows = await this.db
      .select()
      .from(posts)
      .where(where)
      .orderBy(desc(posts.createdAt))
      .limit(Math.max(1, size))
    return Promise.all(rows.map((r) => this.attachCategory(mapBase(r))))
  }

  async findManyByIds(ids: Array<EntityId | string>): Promise<PostRow[]> {
    if (ids.length === 0) return []
    const bigInts = ids.map((id) => parseEntityId(id))
    const rows = await this.db
      .select()
      .from(posts)
      .where(inArray(posts.id, bigInts))
    return Promise.all(rows.map((r) => this.attachCategory(mapBase(r))))
  }

  async findIdsByTitle(search: string): Promise<EntityId[]> {
    const rows = await this.db
      .select({ id: posts.id })
      .from(posts)
      .where(ilike(posts.title, `%${search}%`))
    return rows.map((row) => toEntityId(row.id) as EntityId)
  }

  async aggregateAllTagCounts(): Promise<PostTagCount[]> {
    const result = await this.db.execute<PostTagCount>(sql`
      select unnest(tags) as name, count(*)::int
      from posts
      group by name
      order by count desc, name asc
    `)
    return result.rows.map((row) => ({
      name: row.name,
      count: Number(row.count ?? 0),
    }))
  }

  async aggregateTagCountsByCategory(
    categoryId: EntityId | string,
  ): Promise<PostTagCount[]> {
    const result = await this.db.execute<PostTagCount>(sql`
      select unnest(tags) as name, count(*)::int
      from posts
      where category_id = ${parseEntityId(categoryId)}
      group by name
      order by count desc, name asc
    `)
    return result.rows.map((row) => ({
      name: row.name,
      count: Number(row.count ?? 0),
    }))
  }

  async findByTag(
    tag: string,
    options: { includeCategory?: boolean } = {},
  ): Promise<PostRow[]> {
    const rows = await this.db
      .select()
      .from(posts)
      .where(sql`${tag} = any(${posts.tags})`)
      .orderBy(pinAtDescNullsLast, desc(posts.createdAt))

    const mapped = rows.map(mapBase)
    if (!options.includeCategory) return mapped
    return Promise.all(mapped.map((row) => this.attachCategory(row)))
  }

  async listByCategory(
    categoryId: EntityId | string,
    options: PostListByCategoryOptions = {},
  ): Promise<PostRow[]> {
    const filters: SQL[] = [eq(posts.categoryId, parseEntityId(categoryId))]
    if (options.publishedOnly) filters.push(eq(posts.isPublished, true))

    const query = this.db
      .select()
      .from(posts)
      .where(and(...filters))
      .orderBy(pinAtDescNullsLast, desc(posts.createdAt))

    const rows =
      options.limit === undefined
        ? await query
        : await query.limit(Math.max(1, options.limit))
    const mapped = rows.map(mapBase)
    if (options.includeCategory === false) return mapped
    return Promise.all(mapped.map((row) => this.attachCategory(row)))
  }

  async findByCategoryId(categoryId: EntityId | string): Promise<PostRow[]> {
    return this.listByCategory(categoryId)
  }

  async findByCategoryAndSlug(
    categoryId: EntityId | string,
    slug: string,
    options: { publishedOnly?: boolean } = {},
  ): Promise<PostRow | null> {
    const filters: SQL[] = [
      eq(posts.categoryId, parseEntityId(categoryId)),
      eq(posts.slug, slug),
    ]
    if (options.publishedOnly) filters.push(eq(posts.isPublished, true))
    const [row] = await this.db
      .select()
      .from(posts)
      .where(and(...filters))
      .limit(1)
    return row ? this.attachCategory(mapBase(row)) : null
  }

  async setImages(id: EntityId | string, images: unknown[]): Promise<void> {
    await this.update(id, { images })
  }

  async findAdjacent(
    direction: 'before' | 'after',
    pivotDate: Date,
    options: { publishedOnly?: boolean } = {},
  ): Promise<PostRow | null> {
    const filters: SQL[] = [
      direction === 'before'
        ? sql`${posts.createdAt} < ${pivotDate}`
        : sql`${posts.createdAt} > ${pivotDate}`,
    ]
    if (options.publishedOnly) {
      filters.push(eq(posts.isPublished, true))
    }
    const where = and(...filters)
    const [row] = await this.db
      .select()
      .from(posts)
      .where(where)
      .orderBy(direction === 'before' ? desc(posts.createdAt) : posts.createdAt)
      .limit(1)
    if (!row) return null
    return this.attachCategory(mapBase(row))
  }

  async findOldest(): Promise<PostRow | null> {
    const [row] = await this.db
      .select()
      .from(posts)
      .orderBy(posts.createdAt)
      .limit(1)
    return row ? this.attachCategory(mapBase(row)) : null
  }

  async findByCreatedWindow(
    pivotDate: Date,
    direction: 'before' | 'after',
    limit: number,
    options: { publishedOnly?: boolean } = {},
  ): Promise<PostRow[]> {
    const filters: SQL[] = [
      direction === 'before'
        ? sql`${posts.createdAt} < ${pivotDate}`
        : sql`${posts.createdAt} > ${pivotDate}`,
    ]
    if (options.publishedOnly) filters.push(eq(posts.isPublished, true))
    const rows = await this.db
      .select()
      .from(posts)
      .where(and(...filters))
      .orderBy(
        direction === 'before' ? desc(posts.createdAt) : asc(posts.createdAt),
      )
      .limit(Math.max(1, limit))
    return Promise.all(rows.map((r) => this.attachCategory(mapBase(r))))
  }

  async topTagsByCount(limit: number): Promise<PostTagCount[]> {
    const result = await this.db.execute<PostTagCount>(sql`
      select unnest(tags) as name, count(*)::int
      from posts
      where is_published = true
      group by name
      order by count desc, name asc
      limit ${Math.max(1, limit)}
    `)
    return result.rows.map((row) => ({
      name: row.name,
      count: Number(row.count ?? 0),
    }))
  }

  async findArchiveBuckets(): Promise<
    Array<{ year: number; month: number; count: number }>
  > {
    const rows = await this.db
      .select({
        year: sql<number>`extract(year from ${posts.createdAt})::int`,
        month: sql<number>`extract(month from ${posts.createdAt})::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(posts)
      .groupBy(
        sql`extract(year from ${posts.createdAt})`,
        sql`extract(month from ${posts.createdAt})`,
      )
      .orderBy(
        sql`extract(year from ${posts.createdAt}) desc`,
        sql`extract(month from ${posts.createdAt}) desc`,
      )
    return rows.map((r) => ({
      year: Number(r.year),
      month: Number(r.month),
      count: Number(r.count ?? 0),
    }))
  }

  async setRelatedPosts(
    postId: EntityId | string,
    relatedIds: Array<EntityId | string>,
  ): Promise<void> {
    const idBig = parseEntityId(postId)
    const relatedBigInts = relatedIds.map((r) => parseEntityId(r))
    await this.db.transaction(async (tx) => {
      await tx
        .delete(postRelatedPosts)
        .where(eq(postRelatedPosts.postId, idBig))
      if (relatedBigInts.length === 0) return
      await tx.insert(postRelatedPosts).values(
        relatedBigInts.map((relatedPostId, position) => ({
          postId: idBig,
          relatedPostId,
          position,
        })),
      )
    })
  }

  async getRelatedPosts(postId: EntityId | string): Promise<PostRow[]> {
    const idBig = parseEntityId(postId)
    const links = await this.db
      .select({ relatedPostId: postRelatedPosts.relatedPostId })
      .from(postRelatedPosts)
      .where(eq(postRelatedPosts.postId, idBig))
      .orderBy(postRelatedPosts.position)
    if (links.length === 0) return []
    const ids = links.map((l) => l.relatedPostId)
    const rows = await this.db
      .select()
      .from(posts)
      .where(inArray(posts.id, ids))
    return Promise.all(rows.map((r) => this.attachCategory(mapBase(r))))
  }

  private async attachCategory(row: PostRow): Promise<PostRow> {
    const idBig = parseEntityId(row.categoryId)
    const [cat] = await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, idBig))
      .limit(1)
    if (!cat) return row
    return {
      ...row,
      category: {
        id: toEntityId(cat.id) as EntityId,
        name: cat.name,
        slug: cat.slug,
        type: cat.type,
      },
    }
  }
}
