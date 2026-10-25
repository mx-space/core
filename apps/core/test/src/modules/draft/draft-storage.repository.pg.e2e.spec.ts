import { SnowflakeGenerator } from '@mx-space/db-schema/id'
import * as schema from '@mx-space/db-schema/schema'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { DraftRefType } from '~/modules/draft/draft.enum'
import { DraftRepository } from '~/modules/draft/draft.repository'
import type { RevisionSnapshot } from '~/modules/draft/draft.types'
import { DraftCrdtRepository } from '~/modules/draft/draft-crdt.repository'
import { DraftStorageRepository } from '~/modules/draft/draft-storage.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import type { SnowflakeService } from '~/shared/id/snowflake.service'

const snapshot = (title: string, text = `${title} body`): RevisionSnapshot => ({
  content: null,
  contentFormat: 'markdown',
  images: null,
  meta: null,
  text,
  title,
  typeSpecificData: null,
})

describe('DraftStorageRepository cards (real PG)', () => {
  let pool: Pool
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let db: AppDatabase
  let drafts: DraftRepository
  let crdt: DraftCrdtRepository
  let storage: DraftStorageRepository

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 4 })
    db = drizzle(pool, { schema }) as unknown as AppDatabase
    const snowflake = new SnowflakeGenerator({
      workerId: 47,
    }) as SnowflakeService
    drafts = new DraftRepository(db, snowflake)
    crdt = new DraftCrdtRepository(db, snowflake)
    storage = new DraftStorageRepository(db)
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('lists cards with relation and storage without loading revision bodies', async () => {
    const inSync = await drafts.createDocumentWithRoot(
      DraftRefType.Post,
      null,
      snapshot('Synced'),
      true,
    )
    const synced = await drafts.createBranch(
      inSync.document.id,
      inSync.revision.id,
      snapshot('Synced'),
      true,
    )
    const ahead = await drafts.createDocumentWithRoot(
      DraftRefType.Post,
      null,
      snapshot('Ahead'),
      true,
    )
    const aheadBranch = await drafts.createBranch(
      ahead.document.id,
      ahead.revision.id,
      snapshot('Ahead 2', 'x'.repeat(5000)),
      false,
    )
    const edited = await drafts.createDocumentWithRoot(
      DraftRefType.Note,
      null,
      snapshot('Edited'),
      true,
    )
    const editedBranch = await drafts.createBranch(
      edited.document.id,
      edited.revision.id,
      snapshot('Edited'),
      true,
    )
    await crdt.createDoc({
      documentId: edited.document.id,
      fields: null,
      snapshot: new Uint8Array(100),
      snapshotVersion: new Uint8Array(4),
      syncedRevisionId: edited.revision.id,
    })
    await db.execute(
      sql`update content_crdt_docs set edited_at = now() + interval '1 minute' where document_id = ${edited.document.id}`,
    )
    const fresh = await drafts.createDocumentWithRoot(
      DraftRefType.Note,
      null,
      snapshot('Fresh'),
      false,
    )
    const freshBranch = await drafts.createBranch(
      fresh.document.id,
      fresh.revision.id,
      snapshot('Fresh 2'),
      false,
    )

    const spy = vi.spyOn(pool, 'query')
    const page = await storage.cards(1, 50, {})
    const queries = spy.mock.calls.length
    spy.mockRestore()

    expect(queries).toBeLessThanOrEqual(3)
    const byId = new Map(page.data.map((card) => [card.id, card]))
    expect(byId.get(synced.branch.id)?.relation).toBe('in_sync')
    expect(byId.get(aheadBranch.branch.id)?.relation).toBe('ahead')
    expect(byId.get(editedBranch.branch.id)?.relation).toBe('ahead')
    expect(byId.get(freshBranch.branch.id)?.relation).toBe('fresh')
    const aheadCard = byId.get(aheadBranch.branch.id)!
    expect(aheadCard.headRevision.title).toBe('Ahead 2')
    expect(aheadCard.headRevision).not.toHaveProperty('text')
    expect(aheadCard.storage.revisionCount).toBe(2)
    expect(aheadCard.storage.revisionBytes).toBeGreaterThan(5000)
    expect(byId.get(editedBranch.branch.id)?.storage.crdtBytes).toBe(104)
    expect(page.pagination.total).toBe(4)

    const onlyAhead = await storage.cards(1, 50, { relation: 'ahead' })
    expect(onlyAhead.data.map((card) => card.id).sort()).toEqual(
      [aheadBranch.branch.id, editedBranch.branch.id].sort(),
    )
    const bySize = await storage.cards(1, 50, { sort: 'size' })
    expect(bySize.data[0].id).toBe(aheadBranch.branch.id)

    expect(await storage.relationCounts()).toEqual({
      ahead: 2,
      fresh: 1,
      in_sync: 1,
    })
  })
})
