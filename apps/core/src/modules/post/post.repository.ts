import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, inArray, type SQL, sql } from 'drizzle-orm'

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
  text: string | null
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
  tag?: string
  publishedOnly?: boolean
}

const mapBase = (row: typeof posts.$inferSelect): PostRow => ({
  id: toEntityId(row.id) as EntityId,
  title: row.title,
  slug: row.slug,
  text: row.text,
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
      .orderBy(desc(posts.pinAt), desc(posts.createdAt))
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
    if (params.publishedOnly) {
      filters.push(eq(posts.isPublished, true))
    }
    if (params.tag) {
      filters.push(sql`${posts.tags} @> array[${params.tag}]::text[]`)
    }
    const whereClause = filters.length > 0 ? and(...filters) : undefined

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(posts)
        .where(whereClause)
        .orderBy(desc(posts.pinAt), desc(posts.createdAt))
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
