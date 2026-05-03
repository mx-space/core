import { Inject, Injectable } from '@nestjs/common'
import { asc, eq, inArray, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { metaPresets } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type { MetaPresetModel } from './meta-preset.types'

export type MetaPresetRow = MetaPresetModel & {
  id: EntityId
  _id: EntityId
  createdAt: Date
  created: Date
  updatedAt: Date | null
  updated?: Date | null
}

type StoredField = Partial<MetaPresetModel>

const firstField = (row: typeof metaPresets.$inferSelect): StoredField => {
  const fields = Array.isArray(row.fields) ? row.fields : []
  return (fields[0] ?? {}) as StoredField
}

const toFields = (input: Partial<MetaPresetModel>) => [
  {
    label: input.label,
    type: input.type,
    placeholder: input.placeholder,
    scope: input.scope,
    options: input.options ?? [],
    allowCustomOption: input.allowCustomOption,
    children: input.children ?? [],
    isBuiltin: input.isBuiltin ?? false,
    order: input.order ?? 0,
    enabled: input.enabled ?? true,
  },
]

const mapRow = (row: typeof metaPresets.$inferSelect): MetaPresetRow => {
  const field = firstField(row)
  const id = toEntityId(row.id) as EntityId
  return {
    ...field,
    id,
    _id: id,
    key: row.name,
    label: String(field.label ?? row.name),
    type: field.type as MetaPresetModel['type'],
    description: row.description ?? undefined,
    scope: field.scope as MetaPresetModel['scope'],
    options: field.options,
    allowCustomOption: field.allowCustomOption,
    children: field.children,
    isBuiltin: Boolean(field.isBuiltin),
    order: Number(field.order ?? 0),
    enabled: field.enabled !== false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as MetaPresetRow
}

@Injectable()
export class MetaPresetRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findAll(): Promise<MetaPresetRow[]> {
    const rows = await this.db.select().from(metaPresets)
    return rows.map(mapRow).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  async list(page = 1, size = 50): Promise<PaginationResult<MetaPresetRow>> {
    page = Math.max(1, page)
    size = Math.min(100, Math.max(1, size))
    const offset = (page - 1) * size
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(metaPresets)
        .orderBy(asc(metaPresets.name))
        .limit(size)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(metaPresets),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async findById(id: EntityId | string): Promise<MetaPresetRow | null> {
    const [row] = await this.db
      .select()
      .from(metaPresets)
      .where(eq(metaPresets.id, parseEntityId(id)))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByName(name: string): Promise<MetaPresetRow | null> {
    const [row] = await this.db
      .select()
      .from(metaPresets)
      .where(eq(metaPresets.name, name))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findBySlug(slug: string): Promise<MetaPresetRow | null> {
    return this.findByName(slug)
  }

  async findMaxOrder(): Promise<number> {
    const rows = await this.findAll()
    return rows.reduce((max, row) => Math.max(max, row.order ?? 0), -1)
  }

  async create(input: Partial<MetaPresetModel>): Promise<MetaPresetRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(metaPresets)
      .values({
        id,
        name: input.key!,
        contentType: input.scope,
        description: input.description ?? null,
        fields: toFields(input),
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    input: Partial<MetaPresetModel>,
  ): Promise<MetaPresetRow | null> {
    const existing = await this.findById(id)
    if (!existing) return null
    const next = { ...existing, ...input }
    const [row] = await this.db
      .update(metaPresets)
      .set({
        name: next.key,
        contentType: next.scope,
        description: next.description ?? null,
        fields: toFields(next),
        updatedAt: new Date(),
      })
      .where(eq(metaPresets.id, parseEntityId(id)))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteById(id: EntityId | string): Promise<MetaPresetRow | null> {
    const [row] = await this.db
      .delete(metaPresets)
      .where(eq(metaPresets.id, parseEntityId(id)))
      .returning()
    return row ? mapRow(row) : null
  }

  async updateOrder(ids: string[]): Promise<void> {
    const rows = await this.db
      .select()
      .from(metaPresets)
      .where(
        inArray(
          metaPresets.id,
          ids.map((id) => parseEntityId(id)),
        ),
      )
    for (const row of rows) {
      const index = ids.indexOf(toEntityId(row.id) as EntityId)
      if (index < 0) continue
      await this.update(toEntityId(row.id) as EntityId, { order: index })
    }
  }
}
