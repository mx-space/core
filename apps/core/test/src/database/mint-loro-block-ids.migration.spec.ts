import { createLoroBinding } from '@haklex/rich-collab-loro'
import { allHeadlessNodes } from '@haklex/rich-headless'
import { createHeadlessEditor } from '@lexical/headless'
import { SnowflakeGenerator } from '@mx-space/db-schema/id'
import * as schema from '@mx-space/db-schema/schema'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { $getRoot, $getState, $setState, createState } from 'lexical'
import { LoroDoc } from 'loro-crdt'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { migration } from '~/database/app-migrations/20261026-mint-loro-block-ids'
import { DraftRefType } from '~/modules/draft/draft.enum'
import { DraftRepository } from '~/modules/draft/draft.repository'
import type { RevisionSnapshot } from '~/modules/draft/draft.types'
import { editDocAt, readDocContent } from '~/modules/draft/draft-crdt.doc'
import { DraftCrdtRepository } from '~/modules/draft/draft-crdt.repository'
import { DraftCrdtService } from '~/modules/draft/draft-crdt.service'
import { DraftStorageRepository } from '~/modules/draft/draft-storage.repository'
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

const lexical = (values: string[]): RevisionSnapshot => ({
  content: body(...values),
  contentFormat: 'lexical',
  images: null,
  meta: null,
  text: values.join('\n\n'),
  title: 'Pub',
  typeSpecificData: { slug: 's' },
})

const blocks = (content: string) =>
  (
    JSON.parse(content) as {
      root: {
        children: {
          $?: { blockId?: string }
          children: { text: string }[]
        }[]
      }
    }
  ).root.children.map((child) => ({
    id: child.$?.blockId,
    text: child.children.map((leaf) => leaf.text).join(''),
  }))

const clientBlockId = createState('blockId', {
  parse: (value: unknown) => (typeof value === 'string' ? value : ''),
})

const editorOf = () =>
  createHeadlessEditor({
    nodes: allHeadlessNodes,
    onError: (error) => {
      throw error
    },
  })

const legacyImport = (content: string, message: string) => {
  const doc = new LoroDoc()
  doc.setRecordTimestamp(true)
  const editor = editorOf()
  editor.setEditorState(editor.parseEditorState(content))
  doc.getText('title').insert(0, 'Pub')
  createLoroBinding(editor, doc, { commitMessage: message }).dispose()
  doc.commit({ message })
  return doc
}

const loadEmits = (snapshot: Uint8Array) => {
  const tab = new LoroDoc()
  tab.import(snapshot)
  const from = tab.oplogVersion()
  const editor = editorOf()
  const binding = createLoroBinding(editor, tab)
  editor.update(
    () => {
      const used = new Set<string>()
      for (const child of $getRoot().getChildren()) {
        let id = $getState(child, clientBlockId)
        if (!id || used.has(id)) {
          id = `client-${used.size}`
          $setState(child, clientBlockId, id)
        }
        used.add(id)
      }
    },
    { discrete: true },
  )
  binding.dispose()
  return tab.oplogVersion().compare(from) !== 0
}

describe('mint Loro block ids migration (real PG)', () => {
  let pool: Pool
  let db: AppDatabase
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let drafts: DraftRepository
  let crdt: DraftCrdtRepository
  let service: DraftCrdtService
  let storage: DraftStorageRepository
  const fileReferences = {
    removeReferencesForDocument: vi.fn(),
    updateReferencesForDocument: vi.fn(),
  }

  const seedLegacyImport = async (values: string[]) => {
    const published = lexical(values)
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
    const doc = legacyImport(published.content!, `import ${revision.id}`)
    await crdt.createDoc({
      documentId: document.id,
      fields: { meta: null, typeSpecificData: { slug: 's' } },
      snapshot: doc.export({ mode: 'snapshot' }),
      snapshotVersion: doc.oplogVersion().encode(),
      syncedRevisionId: revision.id,
    })
    const { revisions } = await crdt.appendCheckpoints(branch.id, [
      {
        frontiers: doc.frontiers(),
        kind: 'import',
        snapshot: { ...published, content: readDocContent(doc).content },
      },
    ])
    await crdt.setSyncedRevision(document.id, revisions[0].id)
    return { branch, document, head: revisions[0] }
  }

  const stateOf = async (documentId: string) => {
    const [document] = (
      await db.execute<{ crdt_epoch: number }>(
        sql`select crdt_epoch from content_documents where id = ${documentId}`,
      )
    ).rows
    return {
      epoch: document.crdt_epoch,
      snapshot: (await crdt.findDoc(documentId))!.snapshot,
    }
  }

  const relationOf = async (branchId: string) =>
    (await storage.cards(1, 50, {})).data.find((card) => card.id === branchId)
      ?.relation

  const run = () =>
    migration.up({ db, logger: { log: vi.fn() } as never, pool })

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 4 })
    db = drizzle(pool, { schema }) as unknown as AppDatabase
    const snowflake = new SnowflakeGenerator({
      workerId: 48,
    }) as SnowflakeService
    drafts = new DraftRepository(db, snowflake)
    crdt = new DraftCrdtRepository(db, snowflake)
    service = new DraftCrdtService(drafts, crdt, fileReferences as never)
    storage = new DraftStorageRepository(db)
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('rebuilds an untouched import with block ids and a new epoch', async () => {
    const { branch, document, head } = await seedLegacyImport(['a', 'b'])
    const before = await stateOf(document.id)
    expect(loadEmits(before.snapshot)).toBe(true)

    await run()

    const after = await stateOf(document.id)
    expect(after.epoch).toBe(before.epoch + 1)
    expect(loadEmits(after.snapshot)).toBe(false)
    const doc = new LoroDoc()
    doc.import(await service.exportUpdates(branch.id))
    const content = readDocContent(doc).content
    const ids = blocks(content).map((block) => block.id)
    expect(blocks(content).map((block) => block.text)).toEqual(['a', 'b'])
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    const repaired = await drafts.findRevisionById(head.id)
    expect(repaired?.content).toBe(content)
    expect(repaired?.frontiers).toEqual(doc.frontiers())
    expect((await drafts.findBranchById(branch.id))?.headRevisionId).toBe(
      head.id,
    )
    expect(await relationOf(branch.id)).toBe('in_sync')
  })

  it('is idempotent', async () => {
    const { document } = await seedLegacyImport(['once'])
    await run()
    const first = await stateOf(document.id)

    await run()

    expect(await stateOf(document.id)).toEqual(first)
  })

  it('leaves a working copy edited after its import alone', async () => {
    const { branch, document } = await seedLegacyImport(['a'])
    const tab = new LoroDoc()
    tab.import(await service.exportUpdates(branch.id))
    const from = tab.oplogVersion()
    tab.import(
      editDocAt(
        tab,
        tab.frontiers(),
        { content: body('a', 'typed'), title: 'Pub' },
        'human:owner',
      ),
    )
    await service.importUpdate(branch.id, tab.export({ from, mode: 'update' }))
    const before = await stateOf(document.id)

    await run()

    expect(await stateOf(document.id)).toEqual(before)
  })

  it('leaves a working copy with a field patch after its import alone', async () => {
    const { branch, document } = await seedLegacyImport(['a'])
    await service.updateFields(branch.id, { meta: { cover: 'c.png' } })
    const before = await stateOf(document.id)

    await run()

    expect(await stateOf(document.id)).toEqual(before)
  })

  it('leaves an import that already has block ids alone', async () => {
    const { document } = await drafts.createDocumentWithRoot(
      DraftRefType.Post,
      null,
      lexical(['a']),
      true,
    )
    const branch = await service.workingCopyOfDocument(document.id)
    const before = await stateOf(document.id)

    await run()

    expect(branch).not.toBeNull()
    expect(await stateOf(document.id)).toEqual(before)
  })
})
