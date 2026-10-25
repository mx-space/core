import { SnowflakeGenerator } from '@mx-space/db-schema/id'
import * as schema from '@mx-space/db-schema/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import { LoroDoc } from 'loro-crdt'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors/app-error-code'
import { DraftRefType } from '~/modules/draft/draft.enum'
import { DraftRepository } from '~/modules/draft/draft.repository'
import type { RevisionSnapshot } from '~/modules/draft/draft.types'
import { editDocAt, readDocContent } from '~/modules/draft/draft-crdt.doc'
import { DraftCrdtRepository } from '~/modules/draft/draft-crdt.repository'
import { DraftCrdtService } from '~/modules/draft/draft-crdt.service'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import type { SnowflakeService } from '~/shared/id/snowflake.service'

const paragraph = (value: string) => ({
  children: [
    {
      detail: 0,
      format: 0,
      mode: 'normal',
      style: '',
      text: value,
      type: 'text',
      version: 1,
    },
  ],
  direction: null,
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
})

const body = (...values: string[]) =>
  JSON.stringify({
    root: {
      children: values.map(paragraph),
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  })

const texts = (content: string | null) =>
  (
    JSON.parse(content ?? '{"root":{"children":[]}}') as {
      root: { children: { children: { text: string }[] }[] }
    }
  ).root.children.map((child) => child.children.map((t) => t.text).join(''))

const lexical = (
  title: string,
  values: string[],
  typeSpecificData: Record<string, unknown> | null = { slug: 's' },
): RevisionSnapshot => ({
  content: body(...values),
  contentFormat: 'lexical',
  images: null,
  meta: null,
  text: values.join('\n\n'),
  title,
  typeSpecificData,
})

describe('DraftCrdtService (real PG)', () => {
  let pool: Pool
  let db: AppDatabase
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let drafts: DraftRepository
  let crdt: DraftCrdtRepository
  let service: DraftCrdtService
  const fileReferences = {
    removeReferencesForDocument: vi.fn(),
    updateReferencesForDocument: vi.fn(),
  }

  const seed = async (published = lexical('Pub', ['p1', 'p2'])) => {
    const { document, revision } = await drafts.createDocumentWithRoot(
      DraftRefType.Post,
      null,
      published,
      true,
    )
    const { branch } = await drafts.createBranch(
      document.id,
      revision.id,
      published,
      true,
    )
    return { branch, document, published: revision }
  }

  const clientOf = async (branchId: string) => {
    const doc = new LoroDoc()
    doc.import(await service.exportUpdates(branchId))
    return doc
  }

  const clientEdit = async (
    branchId: string,
    doc: LoroDoc,
    title: string,
    values: string[],
  ) => {
    const from = doc.oplogVersion()
    doc.import(
      editDocAt(
        doc,
        doc.frontiers(),
        { content: body(...values), title },
        'human:owner',
      ),
    )
    await service.importUpdate(branchId, doc.export({ from, mode: 'update' }))
  }

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 4 })
    db = drizzle(pool, { schema }) as unknown as AppDatabase
    const snowflake = new SnowflakeGenerator({
      workerId: 45,
    }) as SnowflakeService
    drafts = new DraftRepository(db, snowflake)
    crdt = new DraftCrdtRepository(db, snowflake)
    service = new DraftCrdtService(drafts, crdt, fileReferences as never)
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('imports a document lazily with an import checkpoint the doc matches', async () => {
    const { branch, document } = await seed()

    const workingCopy = await service.workingCopy(branch.id)

    const head = await drafts.findRevisionById(workingCopy.headRevisionId)
    expect(head).toMatchObject({ kind: 'import', title: 'Pub' })
    expect(head?.frontiers?.length).toBeGreaterThan(0)
    expect(texts(head!.content)).toEqual(['p1', 'p2'])
    const row = await crdt.findDoc(document.id)
    expect(row?.syncedRevisionId).toBe(head!.id)
    expect(row?.fields).toEqual({ meta: null, typeSpecificData: { slug: 's' } })
    expect(readDocContent(await clientOf(branch.id)).title).toBe('Pub')
  })

  it('keeps one working copy, archiving older branches and pinning their follow shares', async () => {
    const { branch: older, document, published } = await seed()
    const { branch: newer } = await drafts.createBranch(
      document.id,
      published.id,
      lexical('Newer', ['n']),
      false,
    )
    await drafts.upsertShare(document.id, 'tok-older', {
      draftId: older.id,
      mode: 'follow',
    })

    const workingCopy = await service.workingCopy(older.id)

    expect(workingCopy.id).toBe(newer.id)
    expect((await drafts.findBranchById(older.id))?.status).toBe('archived')
    expect(await drafts.findShareByToken('tok-older')).toMatchObject({
      draftId: null,
      mode: 'pinned',
      revisionId: older.headRevisionId,
    })
  })

  it('creates a working copy from the published revision when none is active', async () => {
    const { branch, document } = await seed()
    await drafts.archiveBranch(branch.id)

    const workingCopy = await service.workingCopy(branch.id)

    expect(workingCopy.id).not.toBe(branch.id)
    expect(workingCopy.status).toBe('active')
    expect(workingCopy.documentId).toBe(document.id)
  })

  it('syncs peer updates and checkpoints the merged content, skipping no-op saves', async () => {
    const { branch } = await seed()
    const tabA = await clientOf(branch.id)
    const tabB = await clientOf(branch.id)

    await clientEdit(branch.id, tabA, 'Pub', ['p1 from A', 'p2'])
    await clientEdit(branch.id, tabB, 'Pub', ['p1', 'p2 from B'])
    const { revision } = await service.createCheckpoint(branch.id, 'save')
    const again = await service.createCheckpoint(branch.id, 'save')

    expect(revision.kind).toBe('save')
    expect(texts(revision.content)).toEqual(['p1 from A', 'p2 from B'])
    expect(revision.text).toContain('p1 from A')
    expect(again.revision.id).toBe(revision.id)
    expect(fileReferences.updateReferencesForDocument).toHaveBeenCalled()
  })

  it('serves only the updates a client lacks', async () => {
    const { branch } = await seed()
    const tab = await clientOf(branch.id)
    const since = tab.oplogVersion().encode()
    const other = await clientOf(branch.id)
    await clientEdit(branch.id, other, 'Pub', ['p1', 'p2', 'p3'])

    tab.import(await service.exportUpdates(branch.id, since))

    expect(texts(readDocContent(tab).content)).toEqual(['p1', 'p2', 'p3'])
  })

  it('compacts a long update log into the snapshot without losing edits', async () => {
    const { branch, document } = await seed()
    const tab = await clientOf(branch.id)
    for (let i = 0; i < 100; i++) {
      await clientEdit(branch.id, tab, 'Pub', ['p1', `p2 ${i}`])
    }

    await service.workingCopy(branch.id)
    await vi.waitFor(async () => {
      expect(await crdt.findUpdates(document.id)).toHaveLength(0)
    })

    const fresh = await clientOf(branch.id)
    expect(texts(readDocContent(fresh).content)).toEqual(['p1', 'p2 99'])
  })

  it('reloads when another replica compacts between reading the snapshot and the updates', async () => {
    const { branch, document } = await seed()
    const tab = await clientOf(branch.id)
    await clientEdit(branch.id, tab, 'Pub', ['p1', 'p2 edited'])
    const racing = Object.create(crdt) as DraftCrdtRepository
    let raced = false
    racing.findUpdates = async (documentId) => {
      if (!raced) {
        raced = true
        const row = await crdt.findDoc(documentId)
        const updates = await crdt.findUpdates(documentId)
        const full = new LoroDoc()
        full.import(row!.snapshot)
        full.importBatch(updates.map((update) => update.bytes))
        await crdt.compact(documentId, {
          expectedVersion: row!.snapshotVersion,
          foldedIds: updates.map((update) => update.id),
          snapshot: full.export({ mode: 'snapshot' }),
          snapshotVersion: full.oplogVersion().encode(),
        })
      }
      return crdt.findUpdates(documentId)
    }
    const replica = new DraftCrdtService(
      drafts,
      racing,
      fileReferences as never,
    )

    const { revision } = await replica.createCheckpoint(branch.id, 'save')

    expect(raced).toBe(true)
    expect(texts(revision.content)).toEqual(['p1', 'p2 edited'])
    expect(await crdt.findUpdates(document.id)).toHaveLength(0)
  })

  it('rejects an update from another document lineage without storing it', async () => {
    const { branch, document } = await seed()
    await service.workingCopy(branch.id)
    const { branch: strangerBranch } = await seed(lexical('X', ['x']))
    const stranger = await clientOf(strangerBranch.id)

    await expect(
      service.importUpdate(branch.id, stranger.export({ mode: 'update' })),
    ).rejects.toMatchObject({
      code: AppErrorCode.DRAFT_CRDT_UPDATE_REJECTED,
    })
    expect(await crdt.findUpdates(document.id)).toHaveLength(0)
  })

  it('rejects an update not signed by the author the caller expects', async () => {
    const { branch, document } = await seed()
    await service.workingCopy(branch.id)
    const tab = await clientOf(branch.id)
    const from = tab.oplogVersion()
    tab.import(
      editDocAt(
        tab,
        tab.frontiers(),
        { content: body('p1', 'p2', 'p3'), title: 'T' },
        'human:owner',
      ),
    )

    await expect(
      service.importUpdate(
        branch.id,
        tab.export({ from, mode: 'update' }),
        undefined,
        'human:reader-1',
      ),
    ).rejects.toMatchObject({
      code: AppErrorCode.DRAFT_CRDT_UPDATE_REJECTED,
    })
    expect(await crdt.findUpdates(document.id)).toHaveLength(0)
  })

  it('applies a legacy write at its base version and returns its own checkpoint', async () => {
    const { branch } = await seed()
    const workingCopy = await service.workingCopy(branch.id)
    const base = workingCopy.headRevisionId
    const tab = await clientOf(branch.id)
    await clientEdit(branch.id, tab, 'Pub', ['p1', 'p2 unfinished'])
    await service.createCheckpoint(branch.id, 'save')

    const { branch: after, revision } = await service.legacyWrite(
      branch.id,
      base,
      lexical('Pub', ['p1 cli', 'p2'], { slug: 'cli' }),
    )

    expect(texts(revision.content)).toEqual(['p1 cli', 'p2'])
    expect(revision.typeSpecificData).toEqual({ slug: 'cli' })
    expect(revision.kind).toBe('legacy-save')
    const head = await drafts.findRevisionById(after.headRevisionId)
    expect(texts(head!.content)).toEqual(['p1 cli', 'p2 unfinished'])
    expect(head!.typeSpecificData).toEqual({ slug: 'cli' })
    expect(head!.parentRevisionId).toBe(revision.id)
  })

  it('three-way merges a write based on the revision the doc was imported from', async () => {
    const { branch, published } = await seed()
    await service.workingCopy(branch.id)
    const tab = await clientOf(branch.id)
    await clientEdit(branch.id, tab, 'Pub', ['p1', 'p2 owner'])

    const { branch: after } = await service.legacyWrite(
      branch.id,
      published.id,
      lexical('Pub', ['p1 cli', 'p2']),
    )

    const head = await drafts.findRevisionById(after.headRevisionId)
    expect(texts(head!.content)).toEqual(['p1 cli', 'p2 owner'])
  })

  it('rejects a Markdown legacy write to a Loro document', async () => {
    const { branch } = await seed()
    await service.workingCopy(branch.id)

    await expect(
      service.legacyWrite(branch.id, null, {
        ...lexical('M', []),
        content: null,
        contentFormat: 'markdown',
        text: '# md',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.DRAFT_CRDT_FORMAT_UNSUPPORTED,
    })
  })

  it('folds in a save an old pod made outside the Loro doc', async () => {
    const { branch } = await seed()
    const workingCopy = await service.workingCopy(branch.id)
    const tab = await clientOf(branch.id)
    await clientEdit(branch.id, tab, 'Pub', ['p1', 'p2 new'])
    const saved = await drafts.saveBranch(
      branch.id,
      workingCopy.headRevisionId,
      lexical('Old pod', ['p1 old pod', 'p2']),
    )
    expect(saved.kind).toBe('ok')

    const reconciled = await service.workingCopy(branch.id)

    const head = await drafts.findRevisionById(reconciled.headRevisionId)
    expect(head?.kind).toBe('legacy-save')
    expect(head?.title).toBe('Old pod')
    expect(texts(head!.content)).toEqual(['p1 old pod', 'p2 new'])
  })

  it('restores a checkpoint as a new commit, fields included', async () => {
    const { branch } = await seed()
    const imported = await service.workingCopy(branch.id)
    const tab = await clientOf(branch.id)
    await clientEdit(branch.id, tab, 'Changed', ['changed'])
    await service.updateFields(branch.id, { typeSpecificData: { slug: 'x' } })
    await service.createCheckpoint(branch.id, 'save')

    const { revision } = await service.restore(
      branch.id,
      imported.headRevisionId,
    )

    expect(revision.kind).toBe('restore')
    expect(revision.title).toBe('Pub')
    expect(texts(revision.content)).toEqual(['p1', 'p2'])
    expect(revision.typeSpecificData).toEqual({ slug: 's' })
  })

  it('reports every stored change with its origin', async () => {
    const { branch } = await seed()
    const working = await service.workingCopy(branch.id)
    const seen: { documentId: string; origin?: string; update: Uint8Array }[] =
      []
    const stop = service.onDocumentChanged((change) => {
      seen.push(change)
    })
    const tab = await clientOf(branch.id)
    const mirror = await clientOf(branch.id)
    const from = tab.oplogVersion()
    tab.import(
      editDocAt(
        tab,
        tab.frontiers(),
        { content: body('typed'), title: 'Pub' },
        'human:owner',
      ),
    )
    await service.importUpdate(
      branch.id,
      tab.export({ from, mode: 'update' }),
      'conn-1',
    )
    await service.restore(branch.id, working.headRevisionId)
    stop()

    expect(seen.map((change) => change.origin)).toEqual(['conn-1', undefined])
    expect(
      seen.every((change) => change.documentId === branch.documentId),
    ).toBe(true)
    for (const change of seen) mirror.import(change.update)
    expect(texts(readDocContent(mirror).content)).toEqual(['p1', 'p2'])
  })

  it('undoes one step while later edits survive', async () => {
    const { branch } = await seed()
    await service.workingCopy(branch.id)
    const tab = await clientOf(branch.id)
    await clientEdit(branch.id, tab, 'Pub', ['p1', 'p2', 'agent'])
    const { changes } = await service.history(branch.id)
    const step = changes.find((change) => change.message === 'human:owner')!
    await clientEdit(branch.id, tab, 'Pub', ['p1 later', 'p2', 'agent'])

    const { revision } = await service.undo(branch.id, step.id, step.deps)

    expect(revision.kind).toBe('undo')
    expect(texts(revision.content)).toEqual(['p1 later', 'p2'])
  })

  it('merges metadata fields into the next checkpoint', async () => {
    const { branch } = await seed()
    await service.workingCopy(branch.id)

    await service.updateFields(branch.id, {
      meta: { cover: 'c.png' },
      typeSpecificData: { tags: ['a'] },
    })
    const { revision } = await service.createCheckpoint(branch.id, 'save')

    expect(revision.meta).toEqual({ cover: 'c.png' })
    expect(revision.typeSpecificData).toEqual({ slug: 's', tags: ['a'] })
  })

  it('lists checkpoints and change log newest first', async () => {
    const { branch } = await seed()
    await service.workingCopy(branch.id)
    const tab = await clientOf(branch.id)
    await clientEdit(branch.id, tab, 'Pub', ['p1', 'p2', 'p3'])
    await service.createCheckpoint(branch.id, 'save')

    const { changes, checkpoints } = await service.history(branch.id)

    expect(checkpoints.map((row) => row.kind)).toEqual(['save', 'import', null])
    expect(checkpoints[0]).not.toHaveProperty('content')
    expect(checkpoints[0]).toMatchObject({ title: 'Pub' })
    expect(changes[0].message).toBe('human:owner')
    expect(changes.at(-1)?.message).toMatch(/^import /)
  })
})
