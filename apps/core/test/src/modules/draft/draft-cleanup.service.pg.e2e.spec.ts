import { SnowflakeGenerator } from '@mx-space/db-schema/id'
import * as schema from '@mx-space/db-schema/schema'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { LoroDoc } from 'loro-crdt'
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

import { AppErrorCode } from '~/common/errors/app-error-code'
import { DraftRefType } from '~/modules/draft/draft.enum'
import { DraftRepository } from '~/modules/draft/draft.repository'
import type { RevisionSnapshot } from '~/modules/draft/draft.types'
import { DraftCleanupRepository } from '~/modules/draft/draft-cleanup.repository'
import { DraftCleanupService } from '~/modules/draft/draft-cleanup.service'
import { editDocAt, readDocContent } from '~/modules/draft/draft-crdt.doc'
import { DraftCrdtRepository } from '~/modules/draft/draft-crdt.repository'
import { DraftCrdtService } from '~/modules/draft/draft-crdt.service'
import { DraftOrganizerRepository } from '~/modules/draft/draft-organizer.repository'
import { DraftStorageRepository } from '~/modules/draft/draft-storage.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import type { SnowflakeService } from '~/shared/id/snowflake.service'

const body = (...values: string[]) =>
  JSON.stringify({
    root: {
      children: values.map((value) => ({
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
      })),
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  })

const texts = (content: string | null) =>
  (
    JSON.parse(content!) as {
      root: { children: { children: { text: string }[] }[] }
    }
  ).root.children.map((child) => child.children.map((t) => t.text).join(''))

const lexical = (title: string, values: string[]): RevisionSnapshot => ({
  content: body(...values),
  contentFormat: 'lexical',
  images: null,
  meta: null,
  text: values.join('\n\n'),
  title,
  typeSpecificData: { slug: 's' },
})

const markdown = (title: string): RevisionSnapshot => ({
  content: null,
  contentFormat: 'markdown',
  images: null,
  meta: null,
  text: `${title} body`,
  title,
  typeSpecificData: null,
})

const DAY = 86_400_000

describe('DraftCleanupService (real PG)', () => {
  let pool: Pool
  let db: AppDatabase
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let drafts: DraftRepository
  let crdt: DraftCrdtRepository
  let crdtService: DraftCrdtService
  let service: DraftCleanupService
  let storage: DraftStorageRepository
  const fileReferences = {
    removeReferencesForDocument: vi.fn(),
    updateReferencesForDocument: vi.fn(),
  }
  const tasks = { getTasks: vi.fn() }
  const resets: Array<{ documentId: string; reason: string }> = []
  let pageCounter = 7_200_000_000_000_000_000n
  const presence = {
    roomHasMembers: vi.fn<(ns: string, room: string) => Promise<boolean>>(
      async () => false,
    ),
  }

  const seedOrganizerPage = async (title: string, changed = false) => {
    const refId = String(pageCounter++)
    await db.execute(sql`
      insert into pages (id, title, slug, text, content_format, created_at)
      values (${refId}, ${title}, ${refId}, 'Published body', 'markdown', now() - interval '180 days')
    `)
    const { document, revision } = await drafts.createDocumentWithRoot(
      DraftRefType.Page,
      refId,
      markdown(title),
      true,
    )
    const { branch } = await drafts.createBranch(
      document.id,
      revision.id,
      changed ? markdown(`${title} changed`) : markdown(title),
      !changed,
    )
    await age(document.id, 120)
    await db.execute(
      sql`update content_documents set created_at = now() - interval '120 days', updated_at = now() - interval '120 days' where id = ${document.id}`,
    )
    return { branch, document, published: revision, refId }
  }

  const seed = async (snapshot = lexical('Pub', ['p1'])) => {
    const { document, revision } = await drafts.createDocumentWithRoot(
      DraftRefType.Post,
      null,
      snapshot,
      true,
    )
    const { branch } = await drafts.createBranch(
      document.id,
      revision.id,
      snapshot,
      true,
    )
    return { branch, document, published: revision }
  }

  const clientOf = async (branchId: string) => {
    const doc = new LoroDoc()
    doc.import(await crdtService.exportUpdates(branchId))
    return doc
  }

  const type = async (branchId: string, doc: LoroDoc, values: string[]) => {
    const from = doc.oplogVersion()
    doc.import(
      editDocAt(
        doc,
        doc.frontiers(),
        { content: body(...values), title: 'Pub' },
        'human:owner',
      ),
    )
    await crdtService.importUpdate(
      branchId,
      doc.export({ from, mode: 'update' }),
    )
  }

  const publishHead = async (branchId: string) => {
    const { branch, revision } = await crdtService.createCheckpoint(
      branchId,
      'publish',
    )
    const document = await drafts.findDocumentById(branch.documentId)
    await drafts.recordPublication(
      branch.documentId,
      revision.id,
      document!.publishedRevisionId,
    )
    return revision
  }

  const age = async (documentId: string, days: number) => {
    const at = new Date(Date.now() - days * DAY)
    await db.execute(
      sql`update drafts set updated_at = ${at} where document_id = ${documentId}`,
    )
    await db.execute(
      sql`update content_revisions set created_at = ${at} where document_id = ${documentId}`,
    )
    await db.execute(
      sql`update content_crdt_docs set edited_at = ${at}, updated_at = ${at} where document_id = ${documentId}`,
    )
  }

  const revisionIds = async (documentId: string) =>
    (await drafts.findRevisionsByDocument(documentId)).map((row) => row.id)

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 6 })
    db = drizzle(pool, { schema }) as unknown as AppDatabase
    const snowflake = new SnowflakeGenerator({
      workerId: 46,
    }) as SnowflakeService
    drafts = new DraftRepository(db, snowflake)
    crdt = new DraftCrdtRepository(db, snowflake)
    crdtService = new DraftCrdtService(drafts, crdt, fileReferences as never)
    crdtService.onDocumentReset((event) => resets.push(event))
    storage = new DraftStorageRepository(db)
    service = new DraftCleanupService(
      drafts,
      crdtService,
      new DraftCleanupRepository(db),
      storage,
      fileReferences as never,
      tasks as never,
      new DraftOrganizerRepository(db),
      presence as never,
    )
  }, 120_000)

  beforeEach(() => {
    resets.length = 0
    fileReferences.removeReferencesForDocument.mockReset()
    tasks.getTasks.mockReset().mockResolvedValue({ data: [], total: 0 })
    presence.roomHasMembers.mockReset().mockResolvedValue(false)
  })

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('refuses an update appended against a stale epoch and stamps the edit time', async () => {
    const { branch, document } = await seed()
    await crdtService.workingCopy(branch.id)
    const bytes = new LoroDoc().export({ mode: 'update' })
    await db
      .update(schema.contentDocuments)
      .set({ crdtEpoch: 1 })
      .where(eq(schema.contentDocuments.id, document.id))

    await expect(crdt.appendUpdate(document.id, bytes, 0)).rejects.toThrow(
      'CRDT_EPOCH_CHANGED',
    )
    await crdt.appendUpdate(document.id, bytes, 1)

    expect((await crdt.findUpdates(document.id)).length).toBe(1)
    expect((await crdt.findDoc(document.id))?.editedAt).toBeInstanceOf(Date)
  })

  it('hard-deletes a published draft with its CRDT data and unprotected revisions', async () => {
    const { branch, document, published } = await seed()
    const tab = await clientOf(branch.id)
    await type(branch.id, tab, ['p1', 'more'])
    await crdtService.createCheckpoint(branch.id, 'save')
    await drafts.upsertShare(document.id, 'tok-follow', {
      draftId: branch.id,
      mode: 'follow',
    })

    const freed = await service.deleteDraft(branch.id)

    expect(freed.drafts).toBe(1)
    expect(freed.bytes).toBeGreaterThan(0)
    expect(await drafts.findBranchById(branch.id)).toBeNull()
    expect(await crdt.findDoc(document.id)).toBeNull()
    expect(await crdt.findUpdates(document.id)).toEqual([])
    expect(await revisionIds(document.id)).toEqual([published.id])
    expect(await drafts.findShareByToken('tok-follow')).toMatchObject({
      mode: 'pinned',
      revisionId: published.id,
    })
    expect((await drafts.findDocumentById(document.id))?.crdtEpoch).toBe(1)
    expect(resets).toEqual([{ documentId: document.id, reason: 'deleted' }])
    expect(fileReferences.removeReferencesForDocument).toHaveBeenCalledWith(
      branch.id,
      expect.anything(),
    )

    const reopened = await crdtService.workingCopyOfDocument(document.id)
    expect(reopened?.id).not.toBe(branch.id)
    expect(readDocContent(await clientOf(reopened!.id)).title).toBe('Pub')
  })

  it('deletes a never-published document together with its only draft', async () => {
    const { document, revision } = await drafts.createDocumentWithRoot(
      DraftRefType.Note,
      null,
      markdown('Fresh'),
      false,
    )
    const { branch } = await drafts.createBranch(
      document.id,
      revision.id,
      markdown('Fresh 2'),
      false,
    )
    await drafts.upsertShare(document.id, 'tok-fresh', {
      draftId: branch.id,
      mode: 'follow',
    })

    await service.deleteDraft(branch.id)

    expect(await drafts.findDocumentById(document.id)).toBeNull()
    expect(await drafts.findShareByToken('tok-fresh')).toBeNull()
  })

  it('keeps archived drafts and their revisions when the active draft goes', async () => {
    const { branch, document, published } = await seed()
    const { branch: other, headRevision } = await drafts.createBranch(
      document.id,
      published.id,
      lexical('Side', ['side']),
      false,
    )
    await drafts.archiveBranch(other.id)
    await crdtService.workingCopy(branch.id)

    await service.deleteDraft(branch.id)

    expect((await drafts.findBranchById(other.id))?.status).toBe('archived')
    expect(await revisionIds(document.id)).toEqual(
      expect.arrayContaining([published.id, headRevision.id]),
    )
    expect(await crdt.findDoc(document.id)).toBeNull()
  })

  it('compacts history into a fresh lineage that stale tabs cannot write into', async () => {
    const { branch, document, published } = await seed()
    const tab = await clientOf(branch.id)
    for (const word of ['a', 'b', 'c', 'd']) {
      await type(branch.id, tab, ['p1', word])
      await crdtService.createCheckpoint(branch.id, 'save')
    }
    await type(branch.id, tab, ['p1', 'unsaved'])
    expect(
      (await crdtService.history(branch.id)).changes.length,
    ).toBeGreaterThan(3)

    const freed = await service.compact(branch.id)

    expect(freed.revisions).toBeGreaterThan(0)
    const after = await crdtService.workingCopy(branch.id)
    const head = await drafts.findRevisionById(after.headRevisionId)
    const content = readDocContent(await clientOf(branch.id)).content
    expect(texts(content)).toEqual(['p1', 'unsaved'])
    expect(head?.content).toBe(content)
    expect((await crdt.findDoc(document.id))?.syncedRevisionId).toBe(head!.id)
    expect((await crdtService.history(branch.id)).changes.length).toBe(1)
    expect(await revisionIds(document.id)).toEqual(
      expect.arrayContaining([published.id, head!.id]),
    )
    expect((await revisionIds(document.id)).length).toBe(2)
    expect(resets).toEqual([{ documentId: document.id, reason: 'compacted' }])

    const count = (await revisionIds(document.id)).length
    await crdtService.exportUpdates(branch.id)
    expect((await revisionIds(document.id)).length).toBe(count)

    const from = tab.oplogVersion()
    tab.import(
      editDocAt(
        tab,
        tab.frontiers(),
        { content: body('stale'), title: 'Pub' },
        'human:owner',
      ),
    )
    await expect(
      crdtService.importUpdate(branch.id, tab.export({ from, mode: 'update' })),
    ).rejects.toMatchObject({ code: AppErrorCode.DRAFT_CRDT_UPDATE_REJECTED })
    await expect(
      crdtService.exportUpdates(branch.id, tab.oplogVersion().encode()),
    ).rejects.toMatchObject({ code: AppErrorCode.DRAFT_CRDT_STALE })
  })

  it('previews which revisions a compaction would drop', async () => {
    const { branch, document, published } = await seed(markdown('P0'))
    const first = await drafts.saveBranch(
      branch.id,
      published.id,
      markdown('P1'),
    )
    if (first.kind !== 'ok') throw new Error(first.kind)
    const second = await drafts.saveBranch(
      branch.id,
      first.headRevision.id,
      markdown('P2'),
    )
    if (second.kind !== 'ok') throw new Error(second.kind)

    const preview = await service.compactPreview(branch.id)

    expect(preview.revisionIds).toEqual([first.headRevision.id])
    expect(preview.revisionBytes).toBeGreaterThan(0)
    expect(preview.crdtBytes).toBe(0)
    expect(await revisionIds(document.id)).toHaveLength(3)
  })

  it('prunes old intermediate revisions and re-parents the survivors', async () => {
    const { branch, document, published } = await seed(markdown('M0'))
    let head = published.id
    const chain: string[] = []
    for (const title of ['M1', 'M2', 'M3', 'M4']) {
      const saved = await drafts.saveBranch(branch.id, head, markdown(title))
      if (saved.kind !== 'ok') throw new Error(saved.kind)
      head = saved.headRevision.id
      chain.push(head)
    }
    const [m1, m2, m3, m4] = chain
    await drafts.upsertShare(document.id, 'tok-m2', {
      mode: 'pinned',
      revisionId: m2,
    })
    await age(document.id, 60)

    const result = await service.run({ categories: ['B'], olderThanDays: 30 })

    expect(result.freed.revisions).toBe(2)
    const rows = await drafts.findRevisionsByDocument(document.id)
    const parentOf = Object.fromEntries(
      rows.map((row) => [row.id, row.parentRevisionId]),
    )
    expect(Object.keys(parentOf).sort()).toEqual([published.id, m2, m4].sort())
    expect(parentOf[m2]).toBe(published.id)
    expect(parentOf[m4]).toBe(m2)
    expect(parentOf[m1]).toBeUndefined()
    expect(parentOf[m3]).toBeUndefined()
  })

  it('deletes idle in-sync drafts but keeps one holding unpublished CRDT edits', async () => {
    const plain = await seed(markdown('Plain'))
    const synced = await seed()
    await publishHead(synced.branch.id)
    const ahead = await seed()
    await publishHead(ahead.branch.id)
    await type(ahead.branch.id, await clientOf(ahead.branch.id), ['p1', 'x'])
    for (const target of [plain, synced, ahead]) {
      await age(target.document.id, 60)
    }
    await db.execute(
      sql`update content_crdt_docs set edited_at = ${new Date(Date.now() - 40 * DAY)} where document_id = ${ahead.document.id}`,
    )
    const fresh = await seed(markdown('Recent'))

    const preview = await service.preview(30)
    const result = await service.run({ categories: ['A'], olderThanDays: 30 })

    expect(preview.categories.A.count).toBe(2)
    expect(result.freed.drafts).toBe(2)
    expect(await drafts.findBranchById(plain.branch.id)).toBeNull()
    expect(await drafts.findBranchById(synced.branch.id)).toBeNull()
    expect(await drafts.findBranchById(ahead.branch.id)).not.toBeNull()
    expect(await drafts.findBranchById(fresh.branch.id)).not.toBeNull()
  })

  it('keeps a published draft whose only unpublished change is in its fields', async () => {
    const target = await seed()
    await publishHead(target.branch.id)
    await age(target.document.id, 60)
    await crdtService.updateFields(target.branch.id, {
      meta: { summary: 'changed after publish' },
    })

    expect(
      (await crdt.findDoc(target.document.id))?.editedAt?.getTime(),
    ).toBeGreaterThan(Date.now() - 60_000)
    await db.execute(
      sql`update content_crdt_docs set edited_at = null where document_id = ${target.document.id}`,
    )
    const result = await service.run({ categories: ['A'], olderThanDays: 30 })

    expect(result.skipped).toContain(target.document.id)
    expect(await drafts.findBranchById(target.branch.id)).not.toBeNull()
  })

  it('skips documents with a pending publish task', async () => {
    const target = await seed(markdown('Queued'))
    await age(target.document.id, 60)
    tasks.getTasks.mockResolvedValue({
      data: [{ payload: { documentId: target.document.id } }],
      total: 1,
    })

    const result = await service.run({ categories: ['A'], olderThanDays: 30 })

    expect(result.skipped).toContain(target.document.id)
    expect(await drafts.findBranchById(target.branch.id)).not.toBeNull()
    await expect(service.deleteDraft(target.branch.id)).rejects.toMatchObject({
      code: AppErrorCode.DRAFT_PUBLISH_PENDING,
    })
  })

  it('removes CRDT rows whose document has no active draft', async () => {
    const { branch, document } = await seed()
    await crdtService.workingCopy(branch.id)
    await drafts.archiveBranch(branch.id)

    const result = await service.run({ categories: ['D'], olderThanDays: 30 })

    expect(result.freed.crdtDocs).toBe(1)
    expect(await crdt.findDoc(document.id)).toBeNull()
    expect((await drafts.findBranchById(branch.id))?.status).toBe('archived')
  })

  it('maps the scheduled options onto categories with a seven-day floor', async () => {
    const run = vi.spyOn(service, 'run').mockResolvedValue({
      freed: { bytes: 0, crdtDocs: 0, drafts: 0, revisions: 0 },
      skipped: [],
    })
    const options = {
      compactCrdt: true,
      deleteInSyncDrafts: false,
      enable: false,
      olderThanDays: 3,
      pruneRevisions: true,
      removeOrphanCrdt: false,
    }

    expect(await service.runScheduled(options)).toBeNull()
    await service.runScheduled({ ...options, enable: true })

    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith({
      categories: ['B', 'C'],
      olderThanDays: 7,
    })
    run.mockRestore()
  })

  it('leaves collaboration data alone when a draft reappeared after the orphan scan', async () => {
    const { branch, document } = await seed()
    await crdtService.workingCopy(branch.id)
    const scan = vi
      .spyOn(storage, 'orphanCrdtDocs')
      .mockResolvedValue([{ bytes: 1, count: 1, documentId: document.id }])

    const result = await service.run({ categories: ['D'], olderThanDays: 30 })

    expect(result.skipped).toContain(document.id)
    expect(await crdt.findDoc(document.id)).not.toBeNull()
    scan.mockRestore()
  })

  it('reports storage totals per kind', async () => {
    const summary = await service.storage()

    expect(summary.revisions.bytes).toBeGreaterThan(0)
    expect(summary.revisions.count).toBeGreaterThan(0)
    expect(summary.crdt.bytes).toBeGreaterThanOrEqual(0)
    expect(summary.updates.bytes).toBeGreaterThanOrEqual(0)
  })

  it('previews old published articles including changed and archived drafts without writing', async () => {
    const target = await seedOrganizerPage('Organizer preview', true)
    const archived = await drafts.createBranch(
      target.document.id,
      target.published.id,
      markdown('Archived'),
      false,
    )
    await drafts.archiveBranch(archived.branch.id)
    await age(target.document.id, 120)
    const recent = await seedOrganizerPage('Organizer recent')
    await age(recent.document.id, 2)
    const before = await storage.totals()

    const preview = await service.organizerPreview({
      olderThanDays: 90,
      search: 'Organizer',
    })

    expect(preview.map((item) => item.documentId)).toEqual([target.document.id])
    expect(preview[0]).toMatchObject({
      draftCount: 2,
      hasChanges: true,
      refType: 'page',
    })
    expect(preview[0].bytes).toBeGreaterThan(0)
    expect(await storage.totals()).toEqual(before)
  })

  it('organizes all drafts of an article while preserving published and shared versions', async () => {
    const target = await seedOrganizerPage('Organizer remove', true)
    const archived = await drafts.createBranch(
      target.document.id,
      target.published.id,
      markdown('Shared archived'),
      false,
    )
    await drafts.archiveBranch(archived.branch.id)
    await drafts.upsertShare(target.document.id, 'organizer-shared', {
      mode: 'pinned',
      revisionId: archived.headRevision.id,
    })
    await age(target.document.id, 120)
    const [item] = await service.organizerPreview({
      olderThanDays: 90,
      search: 'Organizer remove',
    })

    const result = await service.organize({
      items: [{ documentId: item.documentId, version: item.version }],
      discardChanges: true,
    })

    expect(result.organized).toBe(1)
    expect(result.freed.drafts).toBe(2)
    expect(result.freed.bytes).toBe(item.bytes)
    expect(result.freed.revisions).toBe(item.revisionCount)
    expect(result.skipped).toEqual([])
    expect(await drafts.findBranchById(target.branch.id)).toBeNull()
    expect(await drafts.findBranchById(archived.branch.id)).toBeNull()
    expect((await revisionIds(target.document.id)).sort()).toEqual(
      [target.published.id, archived.headRevision.id].sort(),
    )
    expect(await drafts.findShareByToken('organizer-shared')).toMatchObject({
      revisionId: archived.headRevision.id,
    })
    const live = await db.execute<{ text: string }>(
      sql`select text from pages where id = ${target.refId}`,
    )
    expect(live.rows[0].text).toBe('Published body')
  })

  it('keeps an article whose draft changed after the preview', async () => {
    const target = await seedOrganizerPage('Organizer stale')
    const [item] = await service.organizerPreview({
      olderThanDays: 90,
      search: 'Organizer stale',
    })
    await drafts.saveBranch(
      target.branch.id,
      target.branch.headRevisionId,
      markdown('New work'),
    )

    const result = await service.organize({
      items: [item],
      discardChanges: true,
    })

    expect(result.organized).toBe(0)
    expect(result.skipped).toEqual([
      {
        documentId: target.document.id,
        title: 'Organizer stale',
        reason: 'changed',
      },
    ])
    expect(await drafts.findBranchById(target.branch.id)).not.toBeNull()
  })

  it('requires explicit acknowledgement before discarding unpublished changes', async () => {
    const target = await seedOrganizerPage('Organizer acknowledge', true)
    const [item] = await service.organizerPreview({
      olderThanDays: 90,
      search: 'Organizer acknowledge',
    })

    const result = await service.organize({
      items: [item],
      discardChanges: false,
    })

    expect(result.organized).toBe(0)
    expect(result.skipped[0].reason).toBe('unconfirmed')
    expect(await drafts.findBranchById(target.branch.id)).not.toBeNull()
  })

  it('keeps articles with an editor on another node or a pending publication', async () => {
    const editing = await seedOrganizerPage('Organizer occupied')
    const pending = await seedOrganizerPage('Organizer publishing')
    const items = await service.organizerPreview({
      olderThanDays: 90,
      search: 'Organizer',
    })
    presence.roomHasMembers.mockImplementation(
      async (ns, room) =>
        ns === 'web' && room === `collab:${editing.document.id}`,
    )
    tasks.getTasks.mockResolvedValue({
      data: [{ payload: { documentId: pending.document.id } }],
      total: 1,
    })

    const result = await service.organize({
      items: items.filter(
        (item) =>
          item.documentId === editing.document.id ||
          item.documentId === pending.document.id,
      ),
      discardChanges: true,
    })

    expect(result.skipped.map((item) => item.reason).sort()).toEqual([
      'editing',
      'publishing',
    ])
    expect(await drafts.findBranchById(editing.branch.id)).not.toBeNull()
    expect(await drafts.findBranchById(pending.branch.id)).not.toBeNull()
  })

  it('does not delete when the editor presence check is unavailable', async () => {
    const target = await seedOrganizerPage('Organizer presence failure')
    const items = await service.organizerPreview({
      olderThanDays: 90,
      search: 'Organizer presence failure',
    })
    presence.roomHasMembers.mockRejectedValue(new Error('Redis unavailable'))

    const result = await service.organize({ items, discardChanges: true })

    expect(result.organized).toBe(0)
    expect(result.skipped[0].reason).toBe('failed')
    expect(await drafts.findBranchById(target.branch.id)).not.toBeNull()
  })

  it('checks publishing tasks beyond the first queue page', async () => {
    const target = await seedOrganizerPage('Organizer deep queue')
    const items = await service.organizerPreview({
      olderThanDays: 90,
      search: 'Organizer deep queue',
    })
    tasks.getTasks.mockImplementation(async ({ page }) => ({
      total: 201,
      data:
        page === 1
          ? Array.from({ length: 200 }, () => ({
              payload: { documentId: 'other' },
            }))
          : [{ payload: { documentId: target.document.id } }],
    }))

    const result = await service.organize({ items, discardChanges: true })

    expect(result.skipped[0]?.reason).toBe('publishing')
    expect(await drafts.findBranchById(target.branch.id)).not.toBeNull()
  })

  it('keeps fresh collaboration fields that have not moved the draft head', async () => {
    const target = await seedOrganizerPage('Organizer live fields')
    await drafts.saveBranch(
      target.branch.id,
      target.branch.headRevisionId,
      lexical('Fields', ['hello']),
    )
    await crdtService.workingCopy(target.branch.id)
    await age(target.document.id, 120)
    const items = await service.organizerPreview({
      olderThanDays: 90,
      search: 'Organizer live fields',
    })
    expect(items).toHaveLength(1)
    const head = (await drafts.findBranchById(target.branch.id))!.headRevisionId
    await crdtService.updateFields(target.branch.id, {
      meta: { summary: 'new work' },
    })

    const result = await service.organize({ items, discardChanges: true })

    expect(result.skipped[0]?.reason).toBe('changed')
    expect(
      (await drafts.findBranchById(target.branch.id))?.headRevisionId,
    ).toBe(head)
    expect((await crdt.findDoc(target.document.id))?.fields?.meta).toEqual({
      summary: 'new work',
    })
  })

  it('removes collaboration data and redirects a following share to the published content', async () => {
    const target = await seedOrganizerPage('Organizer collaboration')
    await drafts.saveBranch(
      target.branch.id,
      target.branch.headRevisionId,
      lexical('Collab', ['hello']),
    )
    await crdtService.workingCopy(target.branch.id)
    await drafts.upsertShare(target.document.id, 'organizer-follow', {
      mode: 'follow',
      draftId: target.branch.id,
    })
    await age(target.document.id, 120)
    const [item] = await service.organizerPreview({
      olderThanDays: 90,
      search: 'Organizer collaboration',
    })

    const result = await service.organize({
      items: [item],
      discardChanges: true,
    })

    expect(result.freed.bytes).toBe(item.bytes)
    expect(result.freed.crdtDocs).toBe(1)
    expect(await crdt.findDoc(target.document.id)).toBeNull()
    expect(await crdt.findUpdates(target.document.id)).toEqual([])
    expect(await drafts.findShareByToken('organizer-follow')).toMatchObject({
      mode: 'pinned',
      revisionId: target.published.id,
    })
  })

  it('previews every matching article beyond the draft list page limit', async () => {
    const targets = []
    for (let i = 0; i < 51; i++)
      targets.push(await seedOrganizerPage(`Organizer cross-page ${i}`))

    const preview = await service.organizerPreview({
      olderThanDays: 90,
      search: 'Organizer cross-page',
    })

    expect(preview.map((item) => item.documentId).sort()).toEqual(
      targets.map((item) => item.document.id).sort(),
    )
  })

  it('waits for an in-flight field edit before deciding whether to discard it', async () => {
    const target = await seedOrganizerPage('Organizer concurrent fields')
    await drafts.saveBranch(
      target.branch.id,
      target.branch.headRevisionId,
      lexical('Concurrent', ['hello']),
    )
    await crdtService.workingCopy(target.branch.id)
    await age(target.document.id, 120)
    const items = await service.organizerPreview({
      olderThanDays: 90,
      search: 'Organizer concurrent fields',
    })
    let entered: () => void
    let resume: () => void
    const ready = new Promise<void>((resolve) => {
      entered = resolve
    })
    const paused = new Promise<void>((resolve) => {
      resume = resolve
    })
    const mergeFields = crdt.mergeFields.bind(crdt)
    const merge = vi
      .spyOn(crdt, 'mergeFields')
      .mockImplementation(async (...args) => {
        entered!()
        await paused
        return mergeFields(...args)
      })
    const saving = crdtService.updateFields(target.branch.id, {
      meta: { summary: 'in-flight work' },
    })
    await ready
    const organizing = service.organize({ items, discardChanges: true })
    try {
      await vi.waitFor(
        async () => {
          const waiting = await db.execute<{ count: string }>(
            sql`select count(*) as count from pg_stat_activity where datname = current_database() and wait_event = 'advisory'`,
          )
          expect(Number(waiting.rows[0].count)).toBeGreaterThan(0)
        },
        { timeout: 1500, interval: 20 },
      )
    } finally {
      resume!()
      merge.mockRestore()
      await saving
      await organizing
    }
    expect((await organizing).skipped[0]?.reason).toBe('changed')
    expect((await crdt.findDoc(target.document.id))?.fields?.meta).toEqual({
      summary: 'in-flight work',
    })
  })

  it('excludes withdrawn and scheduled notes even when they have a published revision', async () => {
    for (const [label, published, future] of [
      ['withdrawn', false, false],
      ['scheduled', true, true],
    ] as const) {
      const target = await seedOrganizerPage(
        `Organizer note scope ${label}`,
        true,
      )
      await db.execute(
        sql`insert into notes (id, title, content_format, is_published, public_at) values (${target.refId}, ${label}, 'markdown', ${published}, ${future ? new Date(Date.now() + DAY) : null})`,
      )
      await db.execute(
        sql`update content_documents set ref_type = 'note' where id = ${target.document.id}`,
      )
    }

    const preview = await service.organizerPreview({
      olderThanDays: 90,
      search: 'Organizer note scope',
    })

    expect(preview).toEqual([])
  })
})
