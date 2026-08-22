import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { SnowflakeGenerator } from '@mx-space/db-schema/id'
import * as schema from '@mx-space/db-schema/schema'
import { asc, eq } from 'drizzle-orm'
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
import {
  FileReferenceStatus,
  FileUploadedBy,
} from '~/modules/file/file-reference.types'
import { FileReferenceInventoryService } from '~/modules/file/file-reference-inventory.service'
import { FileReferenceReconciliationService } from '~/modules/file/file-reference-reconciliation.service'
import { FileReferenceUsageRepository } from '~/modules/file/file-reference-usage.repository'
import { FileUsageRepository } from '~/modules/file/file-usage.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import type { SnowflakeService } from '~/shared/id/snowflake.service'

const serverUrl = 'https://api.example.test'
const oldCreatedAt = new Date('2026-01-01T00:00:00.000Z')

describe('File reference reconciliation (real PG and filesystem)', () => {
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let db: AppDatabase
  let fileReferenceRepository: FileReferenceRepository
  let fileReferenceService: FileReferenceService
  let fileUsageRepository: FileUsageRepository
  let inventory: FileReferenceInventoryService
  let pool: Pool
  let reconciliation: FileReferenceReconciliationService
  let root: string
  let usageRepository: FileReferenceUsageRepository

  const configs = {
    get: vi.fn(async (key: string) => {
      if (key === 'url') return { serverUrl }
      if (key === 'imageStorageOptions') return { enable: false }
      throw new Error(`Unexpected config key: ${key}`)
    }),
  }

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 4 })
    db = drizzle(pool, { schema }) as unknown as AppDatabase
    root = await mkdtemp(path.join(tmpdir(), 'mx-file-reconcile-pg-'))
    const snowflake = new SnowflakeGenerator({
      workerId: 43,
    }) as SnowflakeService
    fileReferenceRepository = new FileReferenceRepository(db, snowflake)
    usageRepository = new FileReferenceUsageRepository(db)
    fileUsageRepository = new FileUsageRepository(db, snowflake)
    inventory = new FileReferenceInventoryService(configs as never, root)
    reconciliation = new FileReferenceReconciliationService(
      fileReferenceRepository,
      usageRepository,
      fileUsageRepository,
      inventory,
    )
    fileReferenceService = new FileReferenceService(
      fileReferenceRepository,
      configs as never,
      usageRepository,
      fileUsageRepository,
      root,
    )
  }, 120_000)

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE TABLE file_usages, file_references, posts, snippets, topics, categories, readers, ai_tts, ai_tts_blocks RESTART IDENTITY CASCADE',
    )
    await rm(root, { force: true, recursive: true })
    await mkdir(root, { recursive: true })
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
    await rm(root, { force: true, recursive: true })
  })

  const putFile = async (type: 'audio' | 'file' | 'image', name: string) => {
    const target = path.join(root, type, name)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, `fixture:${name}`)
    return target
  }

  const exists = async (target: string) => {
    try {
      await access(target)
      return true
    } catch {
      return false
    }
  }

  it('rebuilds non-empty post, cover, Skill, topic, local, and reader fixtures idempotently', async () => {
    const sharedUrl = `${serverUrl}/objects/image/shared-cover.png`
    const unusedUrl = `${serverUrl}/objects/file/unused.pdf`
    const legacyUrl = `${serverUrl}/objects/file/%E8%B5%84%E6%96%99%20100%25%23.zip`
    const readerUrl = `${serverUrl}/objects/image/reader-upload.png`
    const sharedPath = await putFile('image', 'shared-cover.png')
    const unusedPath = await putFile('file', 'unused.pdf')
    const legacyPath = await putFile('file', '资料 100%#.zip')
    const orphanPath = await putFile('file', 'orphan.json')
    const readerPath = await putFile('image', 'reader-upload.png')

    await db.insert(schema.categories).values({
      id: '1001',
      name: 'Fixture',
      slug: 'fixture',
    })
    await db.insert(schema.posts).values({
      id: '1002',
      categoryId: '1001',
      contentFormat: 'markdown',
      meta: { cover: sharedUrl },
      slug: 'fixture-post',
      title: 'Fixture post',
    })
    await db.insert(schema.snippets).values({
      id: '1003',
      path: 'fixture-skill',
      raw: `cover: ${sharedUrl}`,
      type: 'skill',
    })
    await db.insert(schema.topics).values({
      id: '1004',
      icon: legacyUrl,
      name: 'Fixture topic',
      slug: 'fixture-topic',
    })
    await db.insert(schema.readers).values({
      id: 'reader-fixture',
      name: 'Reader fixture',
    })
    await db.insert(schema.fileReferences).values([
      {
        id: '2001',
        createdAt: oldCreatedAt,
        fileName: 'shared-cover.png',
        fileUrl: sharedUrl,
        status: FileReferenceStatus.Pending,
        uploadedBy: FileUploadedBy.Owner,
      },
      {
        id: '2002',
        createdAt: oldCreatedAt,
        fileName: 'unused.pdf',
        fileUrl: unusedUrl,
        status: FileReferenceStatus.Active,
        uploadedBy: FileUploadedBy.Owner,
      },
      {
        id: '2003',
        createdAt: oldCreatedAt,
        fileName: 'reader-upload.png',
        fileUrl: readerUrl,
        readerId: 'reader-fixture',
        status: FileReferenceStatus.Pending,
        uploadedBy: FileUploadedBy.Reader,
      },
    ])

    await expect(reconciliation.reconcile()).resolves.toEqual({
      applied: false,
      discoveredLocalFiles: 5,
      isolatedFiles: 2,
      missingReferences: 2,
      referencedFiles: 2,
      scannedFiles: 4,
      statusToActive: 2,
      statusToPending: 1,
      usageChanges: 3,
      usages: 3,
    })
    await expect(db.select().from(schema.fileUsages)).resolves.toHaveLength(0)

    await expect(reconciliation.reconcile({ apply: true })).resolves.toEqual({
      applied: true,
      discoveredLocalFiles: 5,
      isolatedFiles: 2,
      missingReferences: 2,
      referencedFiles: 2,
      scannedFiles: 4,
      statusToActive: 2,
      statusToPending: 1,
      usageChanges: 3,
      usages: 3,
    })

    const references = await db
      .select({
        fileName: schema.fileReferences.fileName,
        id: schema.fileReferences.id,
        status: schema.fileReferences.status,
        uploadedBy: schema.fileReferences.uploadedBy,
      })
      .from(schema.fileReferences)
      .orderBy(asc(schema.fileReferences.fileName))
    expect(references).toEqual([
      {
        fileName: 'orphan.json',
        id: expect.any(String),
        status: FileReferenceStatus.Pending,
        uploadedBy: FileUploadedBy.Owner,
      },
      {
        fileName: 'reader-upload.png',
        id: '2003',
        status: FileReferenceStatus.Pending,
        uploadedBy: FileUploadedBy.Reader,
      },
      {
        fileName: 'shared-cover.png',
        id: '2001',
        status: FileReferenceStatus.Active,
        uploadedBy: FileUploadedBy.Owner,
      },
      {
        fileName: 'unused.pdf',
        id: '2002',
        status: FileReferenceStatus.Pending,
        uploadedBy: FileUploadedBy.Owner,
      },
      {
        fileName: '资料 100%#.zip',
        id: expect.any(String),
        status: FileReferenceStatus.Active,
        uploadedBy: FileUploadedBy.Owner,
      },
    ])

    const usages = await db
      .select({
        sourceField: schema.fileUsages.sourceField,
        sourceId: schema.fileUsages.sourceId,
        sourceType: schema.fileUsages.sourceType,
      })
      .from(schema.fileUsages)
      .orderBy(
        asc(schema.fileUsages.sourceType),
        asc(schema.fileUsages.sourceField),
      )
    expect(usages).toEqual([
      { sourceField: 'meta', sourceId: '1002', sourceType: 'post' },
      { sourceField: 'raw', sourceId: '1003', sourceType: 'skill' },
      { sourceField: 'icon', sourceId: '1004', sourceType: 'topic' },
    ])

    const orphanList = await fileReferenceService.listOrphanFiles(1, 24)
    expect(orphanList.data.map((file) => file.fileName).sort()).toEqual([
      'orphan.json',
      'unused.pdf',
    ])

    await expect(
      reconciliation.reconcile({ apply: true }),
    ).resolves.toMatchObject({
      applied: true,
      missingReferences: 0,
      statusToActive: 0,
      statusToPending: 0,
      usageChanges: 0,
      usages: 3,
    })
    await expect(db.select().from(schema.fileReferences)).resolves.toHaveLength(
      5,
    )
    await expect(db.select().from(schema.fileUsages)).resolves.toHaveLength(3)

    await db
      .update(schema.fileReferences)
      .set({ createdAt: oldCreatedAt })
      .where(eq(schema.fileReferences.uploadedBy, FileUploadedBy.Owner))
    await expect(fileReferenceService.cleanupOrphanFiles(60)).resolves.toEqual({
      deletedCount: 2,
      totalOrphan: 2,
    })
    expect(await exists(sharedPath)).toBe(true)
    expect(await exists(legacyPath)).toBe(true)
    expect(await exists(readerPath)).toBe(true)
    expect(await exists(unusedPath)).toBe(false)
    expect(await exists(orphanPath)).toBe(false)
  })

  it('rejects URL-prefix collisions while accepting query and fragment variants', async () => {
    const collisionUrl = `${serverUrl}/objects/image/collision.png`
    const styledUrl = `${serverUrl}/objects/image/styled.png`
    await putFile('image', 'collision.png')
    await putFile('image', 'styled.png')
    await db.insert(schema.topics).values({
      id: '3001',
      description: `backup=${collisionUrl}.backup`,
      icon: `${styledUrl}?width=640#preview`,
      name: 'Boundary topic',
      slug: 'boundary-topic',
    })
    await db.insert(schema.fileReferences).values([
      {
        id: '3002',
        fileName: 'collision.png',
        fileUrl: collisionUrl,
        status: FileReferenceStatus.Pending,
        uploadedBy: FileUploadedBy.Owner,
      },
      {
        id: '3003',
        fileName: 'styled.png',
        fileUrl: styledUrl,
        status: FileReferenceStatus.Pending,
        uploadedBy: FileUploadedBy.Owner,
      },
    ])

    await expect(
      usageRepository.findReferencedUrls([collisionUrl, styledUrl]),
    ).resolves.toEqual(new Set([styledUrl]))
    await expect(
      usageRepository.findUsageMatches([collisionUrl, styledUrl]),
    ).resolves.toEqual([
      {
        fileUrl: styledUrl,
        sourceField: 'icon',
        sourceId: '3001',
        sourceType: 'topic',
      },
    ])
    await expect(reconciliation.reconcile({ apply: true })).resolves.toEqual({
      applied: true,
      discoveredLocalFiles: 2,
      isolatedFiles: 1,
      missingReferences: 0,
      referencedFiles: 1,
      scannedFiles: 2,
      statusToActive: 1,
      statusToPending: 0,
      usageChanges: 1,
      usages: 1,
    })
  })

  it('classifies a TTS audio object as referenced while its ai_tts_blocks row exists', async () => {
    const audioUrl = `${serverUrl}/objects/audio/tts/9001/en/blk-0-abc123456789.mp3`
    await putFile('audio', 'tts/9001/en/blk-0-abc123456789.mp3')

    await db.insert(schema.aiTts).values({
      id: '9001',
      refId: '9001',
      lang: 'en',
      model: 'tts-1',
      voice: 'alloy',
      speed: 1,
      format: 'mp3',
      blockOrder: ['blk-0'],
      charCount: 5,
    })
    await db.insert(schema.aiTtsBlocks).values({
      id: '9002',
      ttsId: '9001',
      blockId: 'blk-0',
      fingerprint: 'fp-9001',
      chunkIndex: 0,
      text: 'hello',
      url: audioUrl,
      storageBackend: 'local',
      storageKey: 'tts/9001/en/blk-0-abc123456789.mp3',
    })
    await db.insert(schema.fileReferences).values({
      id: '9003',
      fileName: 'blk-0-abc123456789.mp3',
      fileUrl: audioUrl,
      status: FileReferenceStatus.Pending,
      uploadedBy: FileUploadedBy.Owner,
    })

    await expect(fileReferenceService.listOrphanFiles(1, 24)).resolves.toEqual(
      expect.objectContaining({ data: [] }),
    )

    await expect(
      usageRepository.findReferencedUrls([audioUrl]),
    ).resolves.toEqual(new Set([audioUrl]))
    await expect(usageRepository.findUsageMatches([audioUrl])).resolves.toEqual(
      [
        {
          fileUrl: audioUrl,
          sourceField: 'url',
          sourceId: '9002',
          sourceType: 'ai_tts',
        },
      ],
    )

    await reconciliation.reconcile({ apply: true })

    const [reference] = await db
      .select({ status: schema.fileReferences.status })
      .from(schema.fileReferences)
      .where(eq(schema.fileReferences.fileUrl, audioUrl))
    expect(reference?.status).toBe(FileReferenceStatus.Active)
  })

  it('classifies a TTS audio object as isolated once its ai_tts_blocks row is gone', async () => {
    const audioUrl = `${serverUrl}/objects/audio/tts/9001/en/blk-0-abc123456789.mp3`
    await putFile('audio', 'tts/9001/en/blk-0-abc123456789.mp3')

    await db.insert(schema.aiTts).values({
      id: '9001',
      refId: '9001',
      lang: 'en',
      model: 'tts-1',
      voice: 'alloy',
      speed: 1,
      format: 'mp3',
      blockOrder: ['blk-0'],
      charCount: 5,
    })
    await db.insert(schema.aiTtsBlocks).values({
      id: '9002',
      ttsId: '9001',
      blockId: 'blk-0',
      fingerprint: 'fp-9001',
      chunkIndex: 0,
      text: 'hello',
      url: audioUrl,
      storageBackend: 'local',
      storageKey: 'tts/9001/en/blk-0-abc123456789.mp3',
    })
    await reconciliation.reconcile({ apply: true })

    const [referencedBefore] = await db
      .select({ status: schema.fileReferences.status })
      .from(schema.fileReferences)
      .where(eq(schema.fileReferences.fileUrl, audioUrl))
    expect(referencedBefore?.status).toBe(FileReferenceStatus.Active)

    await db.delete(schema.aiTtsBlocks).where(eq(schema.aiTtsBlocks.id, '9002'))

    const orphanList = await fileReferenceService.listOrphanFiles(1, 24)
    expect(orphanList.data.map((file) => file.fileUrl)).toEqual([audioUrl])

    await expect(
      usageRepository.findReferencedUrls([audioUrl]),
    ).resolves.toEqual(new Set())
    await expect(usageRepository.findUsageMatches([audioUrl])).resolves.toEqual(
      [],
    )

    await reconciliation.reconcile({ apply: true })

    const [reference] = await db
      .select({ status: schema.fileReferences.status })
      .from(schema.fileReferences)
      .where(eq(schema.fileReferences.fileUrl, audioUrl))
    expect(reference?.status).toBe(FileReferenceStatus.Pending)
  })

  it('rolls back usage replacement and status changes when an insert fails', async () => {
    await db.insert(schema.fileReferences).values([
      {
        id: '4001',
        fileName: 'pending.png',
        fileUrl: `${serverUrl}/objects/image/pending.png`,
        status: FileReferenceStatus.Pending,
        uploadedBy: FileUploadedBy.Owner,
      },
      {
        id: '4002',
        fileName: 'active.png',
        fileUrl: `${serverUrl}/objects/image/active.png`,
        status: FileReferenceStatus.Active,
        uploadedBy: FileUploadedBy.Owner,
      },
    ])
    await db.insert(schema.fileUsages).values({
      id: '4003',
      fileReferenceId: '4001',
      sourceField: 'meta',
      sourceId: 'fixture-source',
      sourceType: 'post',
    })

    await expect(
      fileUsageRepository.reconcileFileReferences({
        activeIds: ['4001'],
        fileReferenceIds: ['4001', '4002'],
        pendingIds: ['4002'],
        usages: [
          {
            fileReferenceId: '4999',
            sourceField: 'raw',
            sourceId: 'missing-source',
            sourceType: 'skill',
          },
        ],
      }),
    ).rejects.toThrow()

    const statuses = await db
      .select({
        id: schema.fileReferences.id,
        status: schema.fileReferences.status,
      })
      .from(schema.fileReferences)
      .orderBy(asc(schema.fileReferences.id))
    expect(statuses).toEqual([
      { id: '4001', status: FileReferenceStatus.Pending },
      { id: '4002', status: FileReferenceStatus.Active },
    ])
    await expect(db.select().from(schema.fileUsages)).resolves.toEqual([
      expect.objectContaining({
        fileReferenceId: '4001',
        sourceField: 'meta',
        sourceId: 'fixture-source',
        sourceType: 'post',
      }),
    ])
  })
})
