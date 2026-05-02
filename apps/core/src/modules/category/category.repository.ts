import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { categories, posts } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export enum CategoryType {
  Category = 0,
  Tag = 1,
}

export interface CategoryRow {
  id: EntityId
  name: string
  slug: string
  type: CategoryType
  createdAt: Date
}

export interface CategoryWithCount extends CategoryRow {
  count: number
}

export interface CategoryCreateInput {
  name: string
  slug: string
  type?: CategoryType
}

export interface CategoryPatchInput {
  name?: string
  slug?: string
  type?: CategoryType
}

const mapRow = (row: typeof categories.$inferSelect): CategoryRow => ({
  id: toEntityId(row.id) as EntityId,
  name: row.name,
  slug: row.slug,
  type: row.type as CategoryType,
  createdAt: row.createdAt,
})

@Injectable()
export class CategoryRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findAll(
    type: CategoryType = CategoryType.Category,
  ): Promise<CategoryWithCount[]> {
    const rows = await this.db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        type: categories.type,
        createdAt: categories.createdAt,
        count: sql<number>`coalesce(count(${posts.id}), 0)::int`,
      })
      .from(categories)
      .leftJoin(posts, eq(posts.categoryId, categories.id))
      .where(eq(categories.type, type))
      .groupBy(categories.id)
      .orderBy(categories.createdAt)

    return rows.map((r) => ({
      id: toEntityId(r.id) as EntityId,
      name: r.name,
      slug: r.slug,
      type: r.type as CategoryType,
      createdAt: r.createdAt,
      count: Number(r.count ?? 0),
    }))
  }

  async findById(id: EntityId | string): Promise<CategoryWithCount | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        type: categories.type,
        createdAt: categories.createdAt,
        count: sql<number>`(
          select coalesce(count(*), 0)::int
          from ${posts}
          where ${posts.categoryId} = ${categories.id}
        )`,
      })
      .from(categories)
      .where(eq(categories.id, idBig))
      .limit(1)

    if (!row) return null
    return {
      id: toEntityId(row.id) as EntityId,
      name: row.name,
      slug: row.slug,
      type: row.type as CategoryType,
      createdAt: row.createdAt,
      count: Number(row.count ?? 0),
    }
  }

  async findBySlug(slug: string): Promise<CategoryRow | null> {
    const [row] = await this.db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByName(name: string): Promise<CategoryRow | null> {
    const [row] = await this.db
      .select()
      .from(categories)
      .where(eq(categories.name, name))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async create(input: CategoryCreateInput): Promise<CategoryRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(categories)
      .values({
        id,
        name: input.name,
        slug: input.slug,
        type: input.type ?? CategoryType.Category,
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    patch: CategoryPatchInput,
  ): Promise<CategoryRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof categories.$inferInsert> = {}
    if (patch.name !== undefined) update.name = patch.name
    if (patch.slug !== undefined) update.slug = patch.slug
    if (patch.type !== undefined) update.type = patch.type
    if (Object.keys(update).length === 0) {
      const [existing] = await this.db
        .select()
        .from(categories)
        .where(eq(categories.id, idBig))
        .limit(1)
      return existing ? mapRow(existing) : null
    }
    const [row] = await this.db
      .update(categories)
      .set(update)
      .where(eq(categories.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  /**
   * Delete and return the affected row. Throws if the category still has
   * posts attached because of the `on delete restrict` foreign key. Service
   * code should translate that into the existing `CategoryHasPosts`
   * business error.
   */
  async deleteById(id: EntityId | string): Promise<CategoryRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(categories)
      .where(eq(categories.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async countByType(type: CategoryType): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(categories)
      .where(eq(categories.type, type))
    return Number(row?.count ?? 0)
  }

  async countAll(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(categories)
    return Number(row?.count ?? 0)
  }

  /**
   * Aggregate tag→post-count distribution either across all categories or
   * scoped to a single one. Replaces the historic Mongo `$unwind`/`$group`
   * pipeline.
   */
  async sumPostTags(
    options: { categoryId?: EntityId | string } = {},
  ): Promise<Array<{ name: string; count: number }>> {
    const { categoryId } = options
    const tagAlias = sql<string>`tag`
    const tagExpr = sql<string>`unnest(${posts.tags})`
    const whereCategory = categoryId
      ? eq(posts.categoryId, parseEntityId(categoryId))
      : undefined
    const rows = await this.db
      .select({
        name: tagExpr.as('tag'),
        count: sql<number>`count(*)::int`,
      })
      .from(posts)
      .where(whereCategory ? and(whereCategory) : undefined)
      .groupBy(tagAlias)
      .orderBy(sql`count(*) desc`, sql`tag asc`)
    return rows.map((r) => ({ name: r.name, count: Number(r.count ?? 0) }))
  }
}
