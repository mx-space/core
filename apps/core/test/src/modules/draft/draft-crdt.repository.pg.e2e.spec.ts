import { SnowflakeGenerator } from '@mx-space/db-schema/id'
import * as schema from '@mx-space/db-schema/schema'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { DraftRefType } from '~/modules/draft/draft.enum'
import { DraftRepository } from '~/modules/draft/draft.repository'
import { DraftCrdtRepository } from '~/modules/draft/draft-crdt.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import type { SnowflakeService } from '~/shared/id/snowflake.service'

const snapshot = (title: string) => ({
  content: null,
  contentFormat: 'lexical',
  images: null,
  meta: null,
  text: title,
  title,
  typeSpecificData: null,
})

const bytes = (...values: number[]) => new Uint8Array(values)

describe('DraftCrdtRepository (real PG)', () => {
  let pool: Pool
  let db: AppDatabase
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let drafts: DraftRepository
  let repository: DraftCrdtRepository

  const seedDocument = async () => {
    const { document, revision } = await drafts.createDocumentWithRoot(
      DraftRefType.Post,
      null,
      snapshot('Root'),
      false,
    )
    const { branch } = await drafts.createBranch(
      document.id,
      revision.id,
      snapshot('Root'),
      true,
    )
    return { branch, document, revision }
  }

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 4 })
    db = drizzle(pool, { schema }) as unknown as AppDatabase
    const snowflake = new SnowflakeGenerator({
      workerId: 44,
    }) as SnowflakeService
    drafts = new DraftRepository(db, snowflake)
    repository = new DraftCrdtRepository(db, snowflake)
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('creates a doc once and returns the stored row on a second create', async () => {
    const { document, revision } = await seedDocument()

    const first = await repository.createDoc({
      documentId: document.id,
      fields: { meta: null, typeSpecificData: { slug: 'a' } },
      snapshot: bytes(1, 2, 3),
      snapshotVersion: bytes(9),
      syncedRevisionId: revision.id,
    })
    const second = await repository.createDoc({
      documentId: document.id,
      fields: null,
      snapshot: bytes(7),
      snapshotVersion: bytes(7),
      syncedRevisionId: null,
    })

    expect(first.snapshot).toEqual(bytes(1, 2, 3))
    expect(second.snapshot).toEqual(bytes(1, 2, 3))
    expect(second.syncedRevisionId).toBe(revision.id)
    expect(await repository.findDoc(document.id)).toMatchObject({
      fields: { meta: null, typeSpecificData: { slug: 'a' } },
      snapshotVersion: bytes(9),
    })
  })

  it('appends updates and compacts exactly the folded rows', async () => {
    const { document } = await seedDocument()
    await repository.createDoc({
      documentId: document.id,
      fields: null,
      snapshot: bytes(0),
      snapshotVersion: bytes(0),
      syncedRevisionId: null,
    })
    const a = await repository.appendUpdate(document.id, bytes(1))
    const b = await repository.appendUpdate(document.id, bytes(2))

    const loaded = await repository.findUpdates(document.id)
    expect(loaded.map((row) => row.bytes)).toEqual([bytes(1), bytes(2)])

    const late = await repository.appendUpdate(document.id, bytes(3))
    const compacted = await repository.compact(document.id, {
      expectedVersion: bytes(0),
      foldedIds: [a, b],
      snapshot: bytes(1, 2),
      snapshotVersion: bytes(2),
    })

    expect(compacted).toBe(true)
    expect(
      (await repository.findUpdates(document.id)).map((row) => row.id),
    ).toEqual([late])
    expect((await repository.findDoc(document.id))?.snapshot).toEqual(
      bytes(1, 2),
    )
  })

  it('refuses a compaction built from a stale snapshot', async () => {
    const { document } = await seedDocument()
    await repository.createDoc({
      documentId: document.id,
      fields: null,
      snapshot: bytes(0),
      snapshotVersion: bytes(5),
      syncedRevisionId: null,
    })
    const a = await repository.appendUpdate(document.id, bytes(1))

    const compacted = await repository.compact(document.id, {
      expectedVersion: bytes(4),
      foldedIds: [a],
      snapshot: bytes(1),
      snapshotVersion: bytes(6),
    })

    expect(compacted).toBe(false)
    expect(await repository.findUpdates(document.id)).toHaveLength(1)
    expect((await repository.findDoc(document.id))?.snapshot).toEqual(bytes(0))
  })

  it('merges fields per top-level key without clobbering other keys', async () => {
    const { document } = await seedDocument()
    await repository.createDoc({
      documentId: document.id,
      fields: {
        meta: { cover: 'a.png', keep: 1 },
        typeSpecificData: { slug: 'old', tags: ['x'] },
      },
      snapshot: bytes(0),
      snapshotVersion: bytes(0),
      syncedRevisionId: null,
    })

    await repository.mergeFields(document.id, {
      typeSpecificData: { slug: 'new' },
    })
    const merged = await repository.mergeFields(document.id, {
      meta: { cover: null },
    })

    expect(merged).toEqual({
      meta: { cover: null, keep: 1 },
      typeSpecificData: { slug: 'new', tags: ['x'] },
    })
  })

  it('merges into a section that is still null', async () => {
    const { document } = await seedDocument()
    await repository.createDoc({
      documentId: document.id,
      fields: { meta: null, typeSpecificData: null },
      snapshot: bytes(0),
      snapshotVersion: bytes(0),
      syncedRevisionId: null,
    })

    expect(
      await repository.mergeFields(document.id, { meta: { cover: 'c' } }),
    ).toEqual({ meta: { cover: 'c' }, typeSpecificData: null })
  })

  it('chains checkpoints linearly and moves the working copy head to the last', async () => {
    const { branch, revision } = await seedDocument()
    const frontiers = [{ counter: 3, peer: '12' as const }]

    const { branch: moved, revisions } = await repository.appendCheckpoints(
      branch.id,
      [
        { frontiers, kind: 'legacy-save', snapshot: snapshot('Own') },
        { frontiers: null, kind: 'save', snapshot: snapshot('Head') },
      ],
    )

    const [own, head] = revisions
    expect(own).toMatchObject({
      frontiers,
      kind: 'legacy-save',
      parentRevisionId: revision.id,
      title: 'Own',
    })
    expect(head.parentRevisionId).toBe(own.id)
    expect(moved.headRevisionId).toBe(head.id)
    const [row] = await db
      .select()
      .from(schema.drafts)
      .where(eq(schema.drafts.id, branch.id))
    expect(row.headRevisionId).toBe(head.id)
  })

  it('serializes work on the same document under the document lock', async () => {
    const { document } = await seedDocument()
    const order: string[] = []
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const first = repository.withDocumentLock(document.id, async () => {
      order.push('first:start')
      await gate
      order.push('first:end')
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    const second = repository.withDocumentLock(document.id, async () => {
      order.push('second')
    })
    await new Promise((resolve) => setTimeout(resolve, 100))
    release()
    await Promise.all([first, second])

    expect(order).toEqual(['first:start', 'first:end', 'second'])
  })
})
