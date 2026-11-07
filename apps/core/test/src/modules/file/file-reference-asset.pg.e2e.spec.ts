import { SnowflakeGenerator } from '@mx-space/db-schema/id'
import * as schema from '@mx-space/db-schema/schema'
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

import { FileReferenceRepository } from '~/modules/file/file-reference.repository'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { FileReferenceUsageRepository } from '~/modules/file/file-reference-usage.repository'
import { FileUsageRepository } from '~/modules/file/file-usage.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import type { SnowflakeService } from '~/shared/id/snowflake.service'

vi.mock('~/utils/s3.util', () => ({
  S3Uploader: vi.fn(function (this: Record<string, unknown>) {
    this.deleteObject = vi.fn()
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

describe('File reference asset versions (real PG)', () => {
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let pool: Pool
  let repository: FileReferenceRepository
  let service: FileReferenceService

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 4 })
    const db = drizzle(pool, { schema }) as unknown as AppDatabase
    const snowflake = new SnowflakeGenerator({
      workerId: 46,
    }) as SnowflakeService
    repository = new FileReferenceRepository(db, snowflake)
    service = new FileReferenceService(
      repository,
      {
        get: vi.fn(async (key: string) => {
          if (key === 'imageStorageOptions') return s3Config
          throw new Error(`Unexpected config key: ${key}`)
        }),
      } as never,
      new FileReferenceUsageRepository(db),
      new FileUsageRepository(db, snowflake),
    )
  }, 120_000)

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE TABLE file_usages, file_references, drafts, content_crdt_docs, content_revisions, content_documents RESTART IDENTITY CASCADE',
    )
  })

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('stores the asset key and owning draft of an upload', async () => {
    const row = await repository.create({
      fileUrl: 'https://cdn.example.test/versions/a.excalidraw',
      fileName: 'a.excalidraw',
      assetKey: 'asset-1',
      draftId: '7350000000000000001',
    })

    expect(row.assetKey).toBe('asset-1')
    expect(row.draftId).toBe('7350000000000000001')
    const [found] = await repository.findByUrl(
      'https://cdn.example.test/versions/a.excalidraw',
    )
    expect(found.assetKey).toBe('asset-1')
    expect(found.draftId).toBe('7350000000000000001')
  })

  it('leaves both empty for ordinary uploads', async () => {
    const row = await repository.create({
      fileUrl: 'https://cdn.example.test/b.png',
      fileName: 'b.png',
    })

    expect(row.assetKey).toBeNull()
    expect(row.draftId).toBeNull()
  })

  it('tags an uploaded version and backfills the key on its untagged parent', async () => {
    await repository.create({
      fileUrl: 'https://cdn.example.test/old.excalidraw',
      fileName: 'old.excalidraw',
    })
    await repository.create({
      fileUrl: 'https://cdn.example.test/versions/new.excalidraw',
      fileName: 'new.excalidraw',
    })

    await service.tagUploadedAsset(
      'https://cdn.example.test/versions/new.excalidraw',
      {
        assetKey: 'asset-1',
        draftId: '42',
        parentUrl: 'https://cdn.example.test/old.excalidraw',
      },
    )

    const [next] = await repository.findByUrl(
      'https://cdn.example.test/versions/new.excalidraw',
    )
    const [parent] = await repository.findByUrl(
      'https://cdn.example.test/old.excalidraw',
    )
    expect(next.assetKey).toBe('asset-1')
    expect(next.draftId).toBe('42')
    expect(parent.assetKey).toBe('asset-1')
    expect(parent.draftId).toBeNull()
  })

  it('keeps the key a parent already belongs to', async () => {
    await repository.create({
      fileUrl: 'https://cdn.example.test/old.excalidraw',
      fileName: 'old.excalidraw',
      assetKey: 'asset-0',
    })
    await repository.create({
      fileUrl: 'https://cdn.example.test/versions/new.excalidraw',
      fileName: 'new.excalidraw',
    })

    await service.tagUploadedAsset(
      'https://cdn.example.test/versions/new.excalidraw',
      {
        assetKey: 'asset-1',
        parentUrl: 'https://cdn.example.test/old.excalidraw',
      },
    )

    const [parent] = await repository.findByUrl(
      'https://cdn.example.test/old.excalidraw',
    )
    const [next] = await repository.findByUrl(
      'https://cdn.example.test/versions/new.excalidraw',
    )
    expect(parent.assetKey).toBe('asset-0')
    expect(next.assetKey).toBe('asset-0')
  })

  describe('orphan cleanup of draft uploads', () => {
    const hourAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000)

    const seedDraft = async (
      headSavedAt: Date,
      {
        editedAt,
        status = 'active',
      }: { editedAt?: Date; status?: string } = {},
    ) => {
      await pool.query(
        `INSERT INTO content_documents (id, ref_type) VALUES ('900', 'post')`,
      )
      await pool.query(
        `INSERT INTO content_revisions (id, document_id, content_format, created_at) VALUES ('901', '900', 'lexical', $1)`,
        [headSavedAt],
      )
      await pool.query(
        `INSERT INTO drafts (id, document_id, base_revision_id, head_revision_id, status) VALUES ('902', '900', '901', '901', $1)`,
        [status],
      )
      if (editedAt)
        await pool.query(
          `INSERT INTO content_crdt_docs (document_id, snapshot, snapshot_version, edited_at) VALUES ('900', '\\x00', '\\x00', $1)`,
          [editedAt],
        )
    }

    const seedUpload = (url: string, uploadedAt: Date, draftId?: string) =>
      pool.query(
        `INSERT INTO file_references (id, file_url, file_name, status, s3_object_key, draft_id, created_at) VALUES ($1, $2, 'f', 'pending', $3, $4, $5)`,
        [
          String(Math.floor(Math.random() * 1e15)),
          url,
          url.split('/').pop(),
          draftId ?? null,
          uploadedAt,
        ],
      )

    const remainingUrls = async () =>
      (
        await pool.query<{ file_url: string }>(
          'SELECT file_url FROM file_references ORDER BY file_url',
        )
      ).rows.map((row) => row.file_url)

    it('keeps a file uploaded into a draft after its last save', async () => {
      await seedDraft(hourAgo(5), { editedAt: hourAgo(1) })
      await seedUpload(
        'https://cdn.example.test/versions/a.js',
        hourAgo(3),
        '902',
      )

      await service.cleanupOrphanFiles(60)

      expect(await remainingUrls()).toEqual([
        'https://cdn.example.test/versions/a.js',
      ])
    })

    it('removes a draft upload the draft was saved without', async () => {
      await seedDraft(hourAgo(2))
      await seedUpload(
        'https://cdn.example.test/versions/a.js',
        hourAgo(3),
        '902',
      )

      await service.cleanupOrphanFiles(60)

      expect(await remainingUrls()).toEqual([])
    })

    it('removes a draft upload once the draft holds no unsaved edits', async () => {
      await seedDraft(hourAgo(5))
      await seedUpload(
        'https://cdn.example.test/versions/a.js',
        hourAgo(3),
        '902',
      )

      await service.cleanupOrphanFiles(60)

      expect(await remainingUrls()).toEqual([])
    })

    it('removes a draft upload once the draft is archived', async () => {
      await seedDraft(hourAgo(5), { editedAt: hourAgo(1), status: 'archived' })
      await seedUpload(
        'https://cdn.example.test/versions/a.js',
        hourAgo(3),
        '902',
      )

      await service.cleanupOrphanFiles(60)

      expect(await remainingUrls()).toEqual([])
    })

    it('removes uploads of a draft that no longer exists', async () => {
      await seedUpload(
        'https://cdn.example.test/versions/a.js',
        hourAgo(3),
        '902',
      )

      await service.batchDeleteOrphans({ all: true })

      expect(await remainingUrls()).toEqual([])
    })
  })
})
