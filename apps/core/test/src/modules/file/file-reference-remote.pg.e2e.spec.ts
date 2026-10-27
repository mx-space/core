import { SnowflakeGenerator } from '@mx-space/db-schema/id'
import * as schema from '@mx-space/db-schema/schema'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { FileReferenceRepository } from '~/modules/file/file-reference.repository'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import {
  FileReferenceStatus,
  FileUploadedBy,
} from '~/modules/file/file-reference.types'
import { FileReferenceUsageRepository } from '~/modules/file/file-reference-usage.repository'
import { FileUsageRepository } from '~/modules/file/file-usage.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import type { SnowflakeService } from '~/shared/id/snowflake.service'

const deleteObject = vi.hoisted(() => vi.fn())

vi.mock('~/utils/s3.util', () => ({
  S3Uploader: vi.fn(function (this: Record<string, unknown>) {
    this.deleteObject = deleteObject
    this.setCustomDomain = vi.fn()
  }),
}))

const s3Config = {
  enable: true,
  endpoint: 'https://s3.example.test',
  secretId: 'id',
  secretKey: 'key',
  bucket: 'bucket',
}

describe('Remote file references (real PG)', () => {
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let db: AppDatabase
  let pool: Pool
  let service: FileReferenceService
  let imageStorageOptions: Record<string, unknown>

  const configs = {
    get: vi.fn(async (key: string) => {
      if (key === 'imageStorageOptions') return imageStorageOptions
      throw new Error(`Unexpected config key: ${key}`)
    }),
  }

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 4 })
    db = drizzle(pool, { schema }) as unknown as AppDatabase
    const snowflake = new SnowflakeGenerator({
      workerId: 45,
    }) as SnowflakeService
    service = new FileReferenceService(
      new FileReferenceRepository(db, snowflake),
      configs as never,
      new FileReferenceUsageRepository(db),
      new FileUsageRepository(db, snowflake),
    )
  }, 120_000)

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE TABLE file_usages, file_references RESTART IDENTITY CASCADE',
    )
    imageStorageOptions = s3Config
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  const insertReference = (input: {
    id: string
    createdAt: string
    s3ObjectKey?: string
    uploadedBy?: FileUploadedBy
  }) =>
    db.insert(schema.fileReferences).values({
      id: input.id,
      createdAt: new Date(input.createdAt),
      fileName: `${input.id}.png`,
      fileUrl: input.s3ObjectKey
        ? `https://cdn.example.test/${input.s3ObjectKey}`
        : `https://api.example.test/objects/image/${input.id}.png`,
      s3ObjectKey: input.s3ObjectKey ?? null,
      status: FileReferenceStatus.Pending,
      uploadedBy: input.uploadedBy ?? null,
    })

  it('lists only owner bucket objects, newest first, with whether each is in use', async () => {
    await insertReference({
      id: '101',
      createdAt: '2026-10-01T00:00:00.000Z',
      s3ObjectKey: 'posts/used.png',
    })
    await insertReference({
      id: '102',
      createdAt: '2026-10-02T00:00:00.000Z',
      s3ObjectKey: 'posts/unused.png',
    })
    await insertReference({ id: '103', createdAt: '2026-10-03T00:00:00.000Z' })
    await insertReference({
      id: '104',
      createdAt: '2026-10-04T00:00:00.000Z',
      s3ObjectKey: 'comments/reader.png',
      uploadedBy: FileUploadedBy.Reader,
    })
    await db.insert(schema.fileUsages).values({
      id: '201',
      fileReferenceId: '101',
      sourceType: 'post',
      sourceId: '301',
      sourceField: 'content',
    })

    const result = await service.listRemoteFiles(1, 20)

    expect(
      result.data.map((file) => ({ id: file.id, inUse: file.inUse })),
    ).toEqual([
      { id: '102', inUse: false },
      { id: '101', inUse: true },
    ])
    expect(result.pagination.total).toBe(2)
  })

  it('deletes the bucket object and its reference', async () => {
    await insertReference({
      id: '101',
      createdAt: '2026-10-01T00:00:00.000Z',
      s3ObjectKey: 'posts/a.png',
    })

    await service.deleteRemoteFile('101')

    expect(deleteObject).toHaveBeenCalledWith('posts/a.png')
    const rows = await db
      .select()
      .from(schema.fileReferences)
      .where(eq(schema.fileReferences.id, '101'))
    expect(rows).toEqual([])
  })

  it('keeps the reference when the bucket object cannot be deleted', async () => {
    await insertReference({
      id: '101',
      createdAt: '2026-10-01T00:00:00.000Z',
      s3ObjectKey: 'posts/a.png',
    })
    deleteObject.mockRejectedValueOnce(new Error('network down'))

    await expect(service.deleteRemoteFile('101')).rejects.toThrow(
      'network down',
    )

    const rows = await db.select().from(schema.fileReferences)
    expect(rows).toHaveLength(1)
  })

  it('refuses to delete when storage is not configured', async () => {
    await insertReference({
      id: '101',
      createdAt: '2026-10-01T00:00:00.000Z',
      s3ObjectKey: 'posts/a.png',
    })
    imageStorageOptions = { enable: false }

    await expect(service.deleteRemoteFile('101')).rejects.toMatchObject({
      code: AppErrorCode.FILE_STORAGE_NOT_CONFIGURED,
    })
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it('treats a local file or a reader upload as not found', async () => {
    await insertReference({ id: '103', createdAt: '2026-10-03T00:00:00.000Z' })
    await insertReference({
      id: '104',
      createdAt: '2026-10-04T00:00:00.000Z',
      s3ObjectKey: 'comments/reader.png',
      uploadedBy: FileUploadedBy.Reader,
    })

    for (const id of ['103', '104']) {
      await expect(service.deleteRemoteFile(id)).rejects.toMatchObject({
        code: AppErrorCode.NOT_FOUND,
      })
    }
    expect(deleteObject).not.toHaveBeenCalled()
  })
})
