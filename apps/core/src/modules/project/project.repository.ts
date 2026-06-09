import { Inject, Injectable } from '@nestjs/common'
import { desc, eq, sql } from 'drizzle-orm'

import { AppErrorCode, createAppException } from '~/common/errors'
import { PG_DB_TOKEN } from '~/constants/system.constant'
import { projects } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type { ProjectCreateInput, ProjectPatchInput } from './project.dto'
import type { ProjectRow } from './project.types'

const PG_UNIQUE_VIOLATION = '23505'

const isUniqueNameViolation = (err: unknown): err is { code: string } => {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: unknown; constraint_name?: unknown }
  return (
    e.code === PG_UNIQUE_VIOLATION &&
    (e.constraint_name === undefined ||
      e.constraint_name === 'projects_name_uniq')
  )
}

const mapRow = (row: typeof projects.$inferSelect): ProjectRow => ({
  id: toEntityId(row.id) as EntityId,
  name: row.name,
  description: row.description,
  previewUrl: row.previewUrl,
  docUrl: row.docUrl,
  projectUrl: row.projectUrl,
  images: row.images,
  avatar: row.avatar,
  text: row.text,
  createdAt: row.createdAt,
})

@Injectable()
export class ProjectRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async list(page = 1, size = 10): Promise<PaginationResult<ProjectRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(projects)
        .orderBy(desc(projects.createdAt))
        .limit(size)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(projects),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async findAll(): Promise<ProjectRow[]> {
    const rows = await this.db
      .select()
      .from(projects)
      .orderBy(projects.createdAt)
    return rows.map(mapRow)
  }

  async findById(id: EntityId | string): Promise<ProjectRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, idBig))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async create(input: ProjectCreateInput): Promise<ProjectRow> {
    const id = this.snowflake.nextId()
    try {
      const [row] = await this.db
        .insert(projects)
        .values({
          id,
          name: input.name,
          description: input.description,
          previewUrl: input.previewUrl ?? null,
          docUrl: input.docUrl ?? null,
          projectUrl: input.projectUrl ?? null,
          images: input.images ?? null,
          avatar: input.avatar ?? null,
          text: input.text ?? null,
        })
        .returning()
      return mapRow(row)
    } catch (error) {
      if (isUniqueNameViolation(error)) {
        throw createAppException(AppErrorCode.PROJECT_NAME_TAKEN, {
          name: input.name,
        })
      }
      throw error
    }
  }

  async update(
    id: EntityId | string,
    patch: ProjectPatchInput,
  ): Promise<ProjectRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof projects.$inferInsert> = {}
    if (patch.name !== undefined) update.name = patch.name
    if (patch.description !== undefined) update.description = patch.description
    if (patch.previewUrl !== undefined) update.previewUrl = patch.previewUrl
    if (patch.docUrl !== undefined) update.docUrl = patch.docUrl
    if (patch.projectUrl !== undefined) update.projectUrl = patch.projectUrl
    if (patch.images !== undefined) update.images = patch.images
    if (patch.avatar !== undefined) update.avatar = patch.avatar
    if (patch.text !== undefined) update.text = patch.text
    try {
      const [row] = await this.db
        .update(projects)
        .set(update)
        .where(eq(projects.id, idBig))
        .returning()
      return row ? mapRow(row) : null
    } catch (error) {
      if (isUniqueNameViolation(error) && patch.name !== undefined) {
        throw createAppException(AppErrorCode.PROJECT_NAME_TAKEN, {
          name: patch.name,
        })
      }
      throw error
    }
  }

  async deleteById(id: EntityId | string): Promise<ProjectRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(projects)
      .where(eq(projects.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
    return Number(row?.count ?? 0)
  }
}
