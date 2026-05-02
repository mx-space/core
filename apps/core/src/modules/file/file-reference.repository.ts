import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'

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
}

export type FileReferenceType = 'post' | 'note' | 'page' | 'draft'

export interface FileReferenceRow {
  id: EntityId
  fileUrl: string
  fileName: string
  status: FileReferenceStatus
  refId: EntityId | null
  refType: FileReferenceType | null
  s3ObjectKey: string | null
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
