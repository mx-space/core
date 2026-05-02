import { Inject, Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { projects } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface ProjectRow {
  id: EntityId
  name: string
  description: string
  previewUrl: string | null
  docUrl: string | null
  projectUrl: string | null
  images: string[] | null
  avatar: string | null
  text: string | null
  createdAt: Date
}

export interface ProjectCreateInput {
  name: string
  description: string
  previewUrl?: string | null
  docUrl?: string | null
  projectUrl?: string | null
  images?: string[] | null
  avatar?: string | null
  text?: string | null
}

export type ProjectPatchInput = Partial<ProjectCreateInput>

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
    const id = this.snowflake.nextBigInt()
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
    const [row] = await this.db
      .update(projects)
      .set(update)
      .where(eq(projects.id, idBig))
      .returning()
    return row ? mapRow(row) : null
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
