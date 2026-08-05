import { Inject, Injectable } from '@nestjs/common'
import { and, eq, inArray, ne, or, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { fileReferences, fileUsages } from '~/database/schema'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import { FileReferenceStatus } from './file-reference.enum'
import { FileUploadedBy } from './file-reference.types'
import type { FileUsageInput } from './file-usage.types'

const INSERT_BATCH_SIZE = 500

@Injectable()
export class FileUsageRepository {
  constructor(
    @Inject(PG_DB_TOKEN) private readonly db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {}

  async replaceSourceUsages(input: {
    fileUrls: string[]
    sourceId: string
    sourceType: string
    sourceField?: string
  }): Promise<number> {
    const uniqueUrls = [...new Set(input.fileUrls.filter(Boolean))]
    const references = uniqueUrls.length
      ? await this.db
          .select({ id: fileReferences.id })
          .from(fileReferences)
          .where(
            and(
              inArray(fileReferences.fileUrl, uniqueUrls),
              or(
                ne(fileReferences.uploadedBy, FileUploadedBy.Reader),
                sql`${fileReferences.uploadedBy} IS NULL`,
              )!,
            )!,
          )
      : []

    return this.db.transaction(async (tx) => {
      await tx
        .delete(fileUsages)
        .where(
          and(
            eq(fileUsages.sourceType, input.sourceType),
            eq(fileUsages.sourceId, input.sourceId),
          )!,
        )

      const usages: FileUsageInput[] = references.map((reference) => ({
        fileReferenceId: reference.id,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceField: input.sourceField ?? 'content',
      }))
      await this.insertBatches(tx, usages)
      return usages.length
    })
  }

  async findForFileReferences(
    fileReferenceIds: string[],
  ): Promise<FileUsageInput[]> {
    const ids = [...new Set(fileReferenceIds)].map(parseEntityId)
    if (ids.length === 0) return []
    return this.db
      .select({
        fileReferenceId: fileUsages.fileReferenceId,
        sourceField: fileUsages.sourceField,
        sourceId: fileUsages.sourceId,
        sourceType: fileUsages.sourceType,
      })
      .from(fileUsages)
      .where(inArray(fileUsages.fileReferenceId, ids))
  }

  async reconcileFileReferences(input: {
    activeIds: string[]
    fileReferenceIds: string[]
    pendingIds: string[]
    usages: FileUsageInput[]
  }): Promise<number> {
    const ids = [...new Set(input.fileReferenceIds)].map(parseEntityId)
    if (ids.length === 0) return 0
    const activeIds = [...new Set(input.activeIds)].map(parseEntityId)
    const pendingIds = [...new Set(input.pendingIds)].map(parseEntityId)

    return this.db.transaction(async (tx) => {
      await tx
        .delete(fileUsages)
        .where(inArray(fileUsages.fileReferenceId, ids))
      await this.insertBatches(tx, input.usages)
      if (activeIds.length > 0) {
        await tx
          .update(fileReferences)
          .set({
            status: FileReferenceStatus.Active,
            detachedAt: null,
          })
          .where(inArray(fileReferences.id, activeIds))
      }
      if (pendingIds.length > 0) {
        await tx
          .update(fileReferences)
          .set({
            status: FileReferenceStatus.Pending,
            refId: null,
            refType: null,
            detachedAt: null,
          })
          .where(inArray(fileReferences.id, pendingIds))
      }
      return input.usages.length
    })
  }

  private async insertBatches(
    db: Parameters<Parameters<AppDatabase['transaction']>[0]>[0],
    usages: FileUsageInput[],
  ): Promise<void> {
    for (let index = 0; index < usages.length; index += INSERT_BATCH_SIZE) {
      const batch = usages.slice(index, index + INSERT_BATCH_SIZE)
      if (batch.length === 0) continue
      await db.insert(fileUsages).values(
        batch.map((usage) => ({
          id: this.snowflake.nextId(),
          fileReferenceId: parseEntityId(usage.fileReferenceId),
          sourceType: usage.sourceType,
          sourceId: usage.sourceId,
          sourceField: usage.sourceField,
        })),
      )
    }
  }
}
