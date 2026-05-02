import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, lte, or, type SQL, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { notes, topics } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface NoteRow {
  id: EntityId
  nid: number
  title: string | null
  slug: string | null
  text: string | null
  content: string | null
  contentFormat: string
  images: unknown[] | null
  meta: Record<string, unknown> | null
  isPublished: boolean
  hasPassword: boolean
  publicAt: Date | null
  mood: string | null
  weather: string | null
  bookmark: boolean
  coordinates: { latitude: number; longitude: number } | null
  location: string | null
  readCount: number
  likeCount: number
  topicId: EntityId | null
  topic?: { id: EntityId; name: string; slug: string } | null
  createdAt: Date
  modifiedAt: Date | null
}

export interface NoteCreateInput {
  nid: number
  contentFormat: string
  title?: string | null
  slug?: string | null
  text?: string | null
  content?: string | null
  images?: unknown[] | null
  meta?: Record<string, unknown> | null
  isPublished?: boolean
  password?: string | null
  publicAt?: Date | null
  mood?: string | null
  weather?: string | null
  bookmark?: boolean
  coordinates?: { latitude: number; longitude: number } | null
  location?: string | null
  topicId?: EntityId | string | null
}

export type NotePatchInput = Partial<NoteCreateInput> & {
  modifiedAt?: Date | null
}

const mapBase = (row: typeof notes.$inferSelect): NoteRow => ({
  id: toEntityId(row.id) as EntityId,
  nid: row.nid,
  title: row.title,
  slug: row.slug,
  text: row.text,
  content: row.content,
  contentFormat: row.contentFormat,
  images: row.images,
  meta: row.meta,
  isPublished: row.isPublished,
  hasPassword: row.password !== null,
  publicAt: row.publicAt,
  mood: row.mood,
  weather: row.weather,
  bookmark: row.bookmark,
  coordinates: row.coordinates as NoteRow['coordinates'],
  location: row.location,
  readCount: row.readCount,
  likeCount: row.likeCount,
  topicId: row.topicId ? (toEntityId(row.topicId) as EntityId) : null,
  createdAt: row.createdAt,
  modifiedAt: row.modifiedAt,
})

@Injectable()
export class NoteRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async nextNid(): Promise<number> {
    const [row] = await this.db
      .select({ max: sql<number>`coalesce(max(${notes.nid}), 0)::int` })
      .from(notes)
    return Number(row?.max ?? 0) + 1
  }

  async findById(id: EntityId | string): Promise<NoteRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(notes)
      .where(eq(notes.id, idBig))
      .limit(1)
    if (!row) return null
    return this.attachTopic(mapBase(row))
  }

  async findByNid(nid: number): Promise<NoteRow | null> {
    const [row] = await this.db
      .select()
      .from(notes)
      .where(eq(notes.nid, nid))
      .limit(1)
    if (!row) return null
    return this.attachTopic(mapBase(row))
  }

  async findBySlug(slug: string): Promise<NoteRow | null> {
    const [row] = await this.db
      .select()
      .from(notes)
      .where(eq(notes.slug, slug))
      .limit(1)
    if (!row) return null
    return this.attachTopic(mapBase(row))
  }

  /**
   * Visibility predicate matching service behavior: only published notes
   * whose `publicAt` (if set) is in the past.
   */
  private visibleClause(): SQL {
    return and(
      eq(notes.isPublished, true),
      or(sql`${notes.publicAt} is null`, lte(notes.publicAt, new Date()))!,
    )!
  }

  async listVisible(page = 1, size = 10): Promise<PaginationResult<NoteRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const where = this.visibleClause()
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(notes)
        .where(where)
        .orderBy(desc(notes.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(notes)
        .where(where),
    ])
    const data = await Promise.all(
      rows.map((r) => this.attachTopic(mapBase(r))),
    )
    return {
      data,
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async create(input: NoteCreateInput): Promise<NoteRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(notes)
      .values({
        id,
        nid: input.nid,
        title: input.title ?? null,
        slug: input.slug ?? null,
        text: input.text ?? null,
        content: input.content ?? null,
        contentFormat: input.contentFormat,
        images: input.images ?? null,
        meta: input.meta ?? null,
        isPublished: input.isPublished ?? true,
        password: input.password ?? null,
        publicAt: input.publicAt ?? null,
        mood: input.mood ?? null,
        weather: input.weather ?? null,
        bookmark: input.bookmark ?? false,
        coordinates: input.coordinates ?? null,
        location: input.location ?? null,
        topicId: input.topicId ? parseEntityId(input.topicId) : null,
      })
      .returning()
    return this.attachTopic(mapBase(row))
  }

  async update(
    id: EntityId | string,
    patch: NotePatchInput,
  ): Promise<NoteRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof notes.$inferInsert> = {
      modifiedAt: patch.modifiedAt ?? new Date(),
    }
    if (patch.title !== undefined) update.title = patch.title
    if (patch.slug !== undefined) update.slug = patch.slug
    if (patch.text !== undefined) update.text = patch.text
    if (patch.content !== undefined) update.content = patch.content
    if (patch.contentFormat !== undefined)
      update.contentFormat = patch.contentFormat
    if (patch.images !== undefined) update.images = patch.images
    if (patch.meta !== undefined) update.meta = patch.meta
    if (patch.isPublished !== undefined) update.isPublished = patch.isPublished
    if (patch.password !== undefined) update.password = patch.password
    if (patch.publicAt !== undefined) update.publicAt = patch.publicAt
    if (patch.mood !== undefined) update.mood = patch.mood
    if (patch.weather !== undefined) update.weather = patch.weather
    if (patch.bookmark !== undefined) update.bookmark = patch.bookmark
    if (patch.coordinates !== undefined) update.coordinates = patch.coordinates
    if (patch.location !== undefined) update.location = patch.location
    if (patch.topicId !== undefined)
      update.topicId = patch.topicId ? parseEntityId(patch.topicId) : null
    const [row] = await this.db
      .update(notes)
      .set(update)
      .where(eq(notes.id, idBig))
      .returning()
    return row ? this.attachTopic(mapBase(row)) : null
  }

  async deleteById(id: EntityId | string): Promise<NoteRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(notes)
      .where(eq(notes.id, idBig))
      .returning()
    return row ? mapBase(row) : null
  }

  async incrementRead(id: EntityId | string, by = 1): Promise<void> {
    const idBig = parseEntityId(id)
    await this.db
      .update(notes)
      .set({ readCount: sql`${notes.readCount} + ${by}` })
      .where(eq(notes.id, idBig))
  }

  async incrementLike(id: EntityId | string, by = 1): Promise<void> {
    const idBig = parseEntityId(id)
    await this.db
      .update(notes)
      .set({ likeCount: sql`${notes.likeCount} + ${by}` })
      .where(eq(notes.id, idBig))
  }

  private async attachTopic(row: NoteRow): Promise<NoteRow> {
    if (!row.topicId) return { ...row, topic: null }
    const [topic] = await this.db
      .select({ id: topics.id, name: topics.name, slug: topics.slug })
      .from(topics)
      .where(eq(topics.id, parseEntityId(row.topicId)))
      .limit(1)
    return {
      ...row,
      topic: topic
        ? {
            id: toEntityId(topic.id) as EntityId,
            name: topic.name,
            slug: topic.slug,
          }
        : null,
    }
  }
}
