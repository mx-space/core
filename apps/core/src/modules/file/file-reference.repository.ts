import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, gte, inArray, lt, ne, or, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { fileReferences } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export enum FileReferenceStatus {
  Pending = 'pending',
  Active = 'active',
  Detached = 'detached',
}

export enum FileUploadedBy {
  Owner = 'owner',
  Reader = 'reader',
}

export enum FileDeletionReason {
  PendingTtl = 'pending_ttl',
  DetachedTtl = 'detached_ttl',
  CommentDeleted = 'comment_deleted',
  CommentSpam = 'comment_spam',
  CascadePostDeleted = 'cascade_post_deleted',
  Manual = 'manual',
}

export type FileReferenceType =
  | 'post'
  | 'note'
  | 'page'
  | 'draft'
  | 'comment'

export interface FileReferenceRow {
  id: EntityId
  fileUrl: string
  fileName: string
  status: FileReferenceStatus
  refId: EntityId | null
  refType: FileReferenceType | null
  s3ObjectKey: string | null
  readerId: string | null
  uploadedBy: FileUploadedBy | null
  mimeType: string | null
  byteSize: number | null
  detachedAt: Date | null
  createdAt: Date
}

const mapRow = (row: typeof fileReferences.$inferSelect): FileReferenceRow => ({
  id: toEntityId(row.id) as EntityId,
  fileUrl: row.fileUrl,
  fileName: row.fileName,
  status: row.status as FileReferenceStatus,
  refId: row.refId ? (toEntityId(row.refId) as EntityId) : null,
  refType: (row.refType ?? null) as FileReferenceType | null,
  s3ObjectKey: row.s3ObjectKey,
  readerId: row.readerId ?? null,
  uploadedBy: (row.uploadedBy ?? null) as FileUploadedBy | null,
  mimeType: row.mimeType ?? null,
  byteSize: row.byteSize ?? null,
  detachedAt: row.detachedAt ?? null,
  createdAt: row.createdAt,
})

@Injectable()
export class FileReferenceRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findById(id: EntityId | string): Promise<FileReferenceRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(fileReferences)
      .where(eq(fileReferences.id, idBig))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByUrl(fileUrl: string): Promise<FileReferenceRow[]> {
    const rows = await this.db
      .select()
      .from(fileReferences)
      .where(eq(fileReferences.fileUrl, fileUrl))
    return rows.map(mapRow)
  }

  async findFirstByUrl(fileUrl: string): Promise<FileReferenceRow | null> {
    const [row] = await this.db
      .select()
      .from(fileReferences)
      .where(eq(fileReferences.fileUrl, fileUrl))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByRef(
    refType: FileReferenceType,
    refId: EntityId | string,
  ): Promise<FileReferenceRow[]> {
    const rows = await this.db
      .select()
      .from(fileReferences)
      .where(
        and(
          eq(fileReferences.refType, refType),
          eq(fileReferences.refId, parseEntityId(refId)),
        )!,
      )
    return rows.map(mapRow)
  }

  async create(input: {
    fileUrl: string
    fileName: string
    status?: FileReferenceStatus
    refType?: FileReferenceType | null
    refId?: EntityId | string | null
    s3ObjectKey?: string | null
    readerId?: string | null
    uploadedBy?: FileUploadedBy | null
    mimeType?: string | null
    byteSize?: number | null
  }): Promise<FileReferenceRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(fileReferences)
      .values({
        id,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        status: input.status ?? FileReferenceStatus.Pending,
        refType: input.refType ?? null,
        refId: input.refId ? parseEntityId(input.refId) : null,
        s3ObjectKey: input.s3ObjectKey ?? null,
        readerId: input.readerId ?? null,
        uploadedBy: input.uploadedBy ?? null,
        mimeType: input.mimeType ?? null,
        byteSize: input.byteSize ?? null,
      })
      .returning()
    return mapRow(row)
  }

  async setStatus(
    id: EntityId | string,
    status: FileReferenceStatus,
  ): Promise<FileReferenceRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .update(fileReferences)
      .set({ status })
      .where(eq(fileReferences.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async activateByUrls(
    fileUrls: string[],
    refType: FileReferenceType,
    refId: EntityId | string,
  ): Promise<number> {
    if (!fileUrls.length) return 0
    const result = await this.db
      .update(fileReferences)
      .set({
        status: FileReferenceStatus.Active,
        refType,
        refId: parseEntityId(refId),
      })
      .where(inArray(fileReferences.fileUrl, fileUrls))
      .returning({ id: fileReferences.id })
    return result.length
  }

  async markDocumentPending(
    refType: FileReferenceType,
    refId: EntityId | string,
  ): Promise<number> {
    const result = await this.db
      .update(fileReferences)
      .set({
        status: FileReferenceStatus.Pending,
        refId: null,
      })
      .where(
        and(
          eq(fileReferences.refType, refType),
          eq(fileReferences.refId, parseEntityId(refId)),
        )!,
      )
      .returning({ id: fileReferences.id })
    return result.length
  }

  async activateUrl(
    fileUrl: string,
    refType: FileReferenceType,
    refId: EntityId | string,
  ): Promise<FileReferenceRow | null> {
    const [row] = await this.db
      .update(fileReferences)
      .set({
        status: FileReferenceStatus.Active,
        refType,
        refId: parseEntityId(refId),
      })
      .where(eq(fileReferences.fileUrl, fileUrl))
      .returning()
    return row ? mapRow(row) : null
  }

  async listPending(
    page = 1,
    size = 20,
  ): Promise<PaginationResult<FileReferenceRow>> {
    page = Math.max(1, page)
    size = Math.min(100, Math.max(1, size))
    const offset = (page - 1) * size
    const where = eq(fileReferences.status, FileReferenceStatus.Pending)
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(fileReferences)
        .where(where)
        .orderBy(desc(fileReferences.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(fileReferences)
        .where(where),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async findPendingOlderThan(threshold: Date): Promise<FileReferenceRow[]> {
    const rows = await this.db
      .select()
      .from(fileReferences)
      .where(
        and(
          eq(fileReferences.status, FileReferenceStatus.Pending),
          sql`${fileReferences.createdAt} < ${threshold}`,
        )!,
      )
    return rows.map(mapRow)
  }

  async findPending(): Promise<FileReferenceRow[]> {
    const rows = await this.db
      .select()
      .from(fileReferences)
      .where(eq(fileReferences.status, FileReferenceStatus.Pending))
    return rows.map(mapRow)
  }

  async countPending(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(fileReferences)
      .where(eq(fileReferences.status, FileReferenceStatus.Pending))
    return Number(row?.count ?? 0)
  }

  async deleteById(id: EntityId | string): Promise<FileReferenceRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(fileReferences)
      .where(eq(fileReferences.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async findByUrls(fileUrls: string[]): Promise<FileReferenceRow[]> {
    if (!fileUrls.length) return []
    const rows = await this.db
      .select()
      .from(fileReferences)
      .where(inArray(fileReferences.fileUrl, fileUrls))
    return rows.map(mapRow)
  }

  async findActiveOrDetachedByCommentId(
    commentId: EntityId | string,
  ): Promise<FileReferenceRow[]> {
    const rows = await this.db
      .select()
      .from(fileReferences)
      .where(
        and(
          eq(fileReferences.refType, 'comment'),
          eq(fileReferences.refId, parseEntityId(commentId)),
          inArray(fileReferences.status, [
            FileReferenceStatus.Active,
            FileReferenceStatus.Detached,
          ]),
        )!,
      )
    return rows.map(mapRow)
  }

  async markActive(
    id: EntityId | string,
    refId: EntityId | string,
    refType: FileReferenceType,
    s3ObjectKey?: string | null,
  ): Promise<FileReferenceRow | null> {
    const idBig = parseEntityId(id)
    const update: Record<string, unknown> = {
      status: FileReferenceStatus.Active,
      refId: parseEntityId(refId),
      refType,
      detachedAt: null,
    }
    if (s3ObjectKey !== undefined) {
      update.s3ObjectKey = s3ObjectKey
    }
    const [row] = await this.db
      .update(fileReferences)
      .set(update)
      .where(eq(fileReferences.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async markDetached(
    id: EntityId | string,
  ): Promise<FileReferenceRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .update(fileReferences)
      .set({
        status: FileReferenceStatus.Detached,
        detachedAt: new Date(),
      })
      .where(eq(fileReferences.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async countReaderUploadsSince(
    readerId: string,
    since: Date,
  ): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(fileReferences)
      .where(
        and(
          eq(fileReferences.readerId, readerId),
          eq(fileReferences.uploadedBy, FileUploadedBy.Reader),
          gte(fileReferences.createdAt, since),
        )!,
      )
    return Number(row?.count ?? 0)
  }

  async sumReaderActiveBytes(readerId: string): Promise<number> {
    const [row] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(COALESCE(${fileReferences.byteSize}, 0)), 0)::bigint`,
      })
      .from(fileReferences)
      .where(
        and(
          eq(fileReferences.readerId, readerId),
          eq(fileReferences.uploadedBy, FileUploadedBy.Reader),
          inArray(fileReferences.status, [
            FileReferenceStatus.Pending,
            FileReferenceStatus.Active,
          ]),
        )!,
      )
    return Number(row?.total ?? 0)
  }

  async findReaderPendingOlderThan(
    threshold: Date,
  ): Promise<FileReferenceRow[]> {
    const rows = await this.db
      .select()
      .from(fileReferences)
      .where(
        and(
          eq(fileReferences.uploadedBy, FileUploadedBy.Reader),
          eq(fileReferences.status, FileReferenceStatus.Pending),
          lt(fileReferences.createdAt, threshold),
        )!,
      )
    return rows.map(mapRow)
  }

  async findReaderDetachedOlderThan(
    threshold: Date,
  ): Promise<FileReferenceRow[]> {
    const rows = await this.db
      .select()
      .from(fileReferences)
      .where(
        and(
          eq(fileReferences.uploadedBy, FileUploadedBy.Reader),
          eq(fileReferences.status, FileReferenceStatus.Detached),
          lt(fileReferences.detachedAt, threshold),
        )!,
      )
    return rows.map(mapRow)
  }

  async findByCommentId(
    commentId: EntityId | string,
  ): Promise<FileReferenceRow[]> {
    const rows = await this.db
      .select()
      .from(fileReferences)
      .where(
        and(
          eq(fileReferences.refType, 'comment'),
          eq(fileReferences.refId, parseEntityId(commentId)),
        )!,
      )
    return rows.map(mapRow)
  }

  async listReaderUploads(params: {
    page?: number
    size?: number
    status?: FileReferenceStatus
    readerId?: string
    refId?: EntityId | string
  }): Promise<PaginationResult<FileReferenceRow>> {
    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(100, Math.max(1, params.size ?? 20))
    const offset = (page - 1) * size
    const conditions = [eq(fileReferences.uploadedBy, FileUploadedBy.Reader)]
    if (params.status) {
      conditions.push(eq(fileReferences.status, params.status))
    }
    if (params.readerId) {
      conditions.push(eq(fileReferences.readerId, params.readerId))
    }
    if (params.refId) {
      conditions.push(eq(fileReferences.refId, parseEntityId(params.refId)))
    }
    const where = and(...conditions)!
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(fileReferences)
        .where(where)
        .orderBy(desc(fileReferences.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(fileReferences)
        .where(where),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async listOrphans(
    page = 1,
    size = 20,
  ): Promise<PaginationResult<FileReferenceRow>> {
    page = Math.max(1, page)
    size = Math.min(100, Math.max(1, size))
    const offset = (page - 1) * size
    const where = inArray(fileReferences.status, [
      FileReferenceStatus.Pending,
      FileReferenceStatus.Detached,
    ])
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(fileReferences)
        .where(where)
        .orderBy(desc(fileReferences.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(fileReferences)
        .where(where),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async findOwnerPendingOlderThan(
    threshold: Date,
  ): Promise<FileReferenceRow[]> {
    const rows = await this.db
      .select()
      .from(fileReferences)
      .where(
        and(
          eq(fileReferences.status, FileReferenceStatus.Pending),
          or(
            ne(fileReferences.uploadedBy, FileUploadedBy.Reader),
            sql`${fileReferences.uploadedBy} IS NULL`,
          )!,
          lt(fileReferences.createdAt, threshold),
        )!,
      )
    return rows.map(mapRow)
  }

  async deletePendingOlderThan(threshold: Date): Promise<number> {
    const result = await this.db
      .delete(fileReferences)
      .where(
        and(
          eq(fileReferences.status, FileReferenceStatus.Pending),
          sql`${fileReferences.createdAt} < ${threshold}`,
        )!,
      )
      .returning({ id: fileReferences.id })
    return result.length
  }
}
