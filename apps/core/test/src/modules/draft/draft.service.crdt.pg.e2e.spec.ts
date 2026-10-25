import { SnowflakeGenerator } from '@mx-space/db-schema/id'
import * as schema from '@mx-space/db-schema/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import { LoroDoc } from 'loro-crdt'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors/app-error-code'
import { BusinessEvents } from '~/constants/business-event.constant'
import { DraftRefType } from '~/modules/draft/draft.enum'
import { DraftRepository } from '~/modules/draft/draft.repository'
import { DraftService } from '~/modules/draft/draft.service'
import type { RevisionSnapshot } from '~/modules/draft/draft.types'
import { editDocAt } from '~/modules/draft/draft-crdt.doc'
import { DraftCrdtRepository } from '~/modules/draft/draft-crdt.repository'
import { DraftCrdtService } from '~/modules/draft/draft-crdt.service'
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
  text: title,
  title,
  typeSpecificData: null,
})

describe('DraftService on the Loro path (real PG)', () => {
  let pool: Pool
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let drafts: DraftRepository
  let service: DraftService
  let refCounter = 7_100_000_000_000_000_000n
  const emit = vi.fn()
  const fileReferences = {
    removeReferencesForDocument: vi.fn(),
    updateReferencesForDocument: vi.fn(),
  }

  const seed = async (published: RevisionSnapshot) => {
    const refId = String(refCounter++)
    const { document, revision } = await drafts.createDocumentWithRoot(
      DraftRefType.Post,
      refId,
      published,
      true,
    )
    const { branch } = await drafts.createBranch(
      document.id,
      revision.id,
      published,
      true,
    )
    return { branch, document, published: revision, refId }
  }

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 6 })
    const db = drizzle(pool, { schema }) as unknown as AppDatabase
    const snowflake = new SnowflakeGenerator({
      workerId: 46,
    }) as SnowflakeService
    drafts = new DraftRepository(db, snowflake)
    const crdt = new DraftCrdtService(
      drafts,
      new DraftCrdtRepository(db, snowflake),
      fileReferences as never,
    )
    service = new DraftService(
      drafts,
      fileReferences as never,
      {} as never,
      { emit } as never,
      crdt,
    )
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('never conflicts on a stale PUT and returns the write’s own checkpoint', async () => {
    const { branch, published } = await seed(lexical('Pub', ['a', 'b']))
    await service.update(branch.id, {
      data: lexical('Pub', ['a', 'b owner']),
      expectedHeadRevisionId: published.id,
    } as never)

    const view = await service.update(branch.id, {
      data: lexical('Pub', ['a cli', 'b']),
      expectedHeadRevisionId: published.id,
    } as never)

    expect(texts(view.headRevision.content)).toEqual(['a cli', 'b'])
    const stored = await drafts.findBranchById(view.id)
    const head = await drafts.findRevisionById(stored!.headRevisionId)
    expect(texts(head!.content)).toEqual(['a cli', 'b owner'])
    expect(emit).toHaveBeenCalledWith(
      BusinessEvents.DRAFT_UPDATE,
      expect.objectContaining({ headRevisionId: stored!.headRevisionId }),
      expect.anything(),
    )
  })

  it('writes a CLI save against the published base into the working copy', async () => {
    const { branch, published, refId } = await seed(lexical('Pub', ['a']))

    const view = await service.create({
      baseRevisionId: published.id,
      data: lexical('Pub', ['a', 'cli']),
      refId,
      refType: DraftRefType.Post,
    } as never)

    expect(view.id).toBe(branch.id)
    expect(texts(view.headRevision.content)).toEqual(['a', 'cli'])
    expect(await drafts.findBranchesByDocument(branch.documentId)).toHaveLength(
      1,
    )
  })

  it('keeps the branch flow and its conflicts for Markdown documents', async () => {
    const { branch, published } = await seed(markdown('Md'))
    await service.update(branch.id, {
      data: markdown('Md 2'),
      expectedHeadRevisionId: published.id,
    } as never)

    await expect(
      service.update(branch.id, {
        data: markdown('Md 3'),
        expectedHeadRevisionId: published.id,
      } as never),
    ).rejects.toMatchObject({ code: AppErrorCode.DRAFT_HEAD_CONFLICT })
  })

  it('collapses a Lexical document to one branch when its context is read', async () => {
    const { document, published, refId } = await seed(lexical('Pub', ['a']))
    await drafts.createBranch(
      document.id,
      published.id,
      lexical('Other', ['o']),
      false,
    )

    const context = await service.getContext(DraftRefType.Post, refId)

    expect(context.branches).toHaveLength(1)
    expect(context.branches[0].headRevision.kind).toBe('import')
  })

  it('discards a Lexical working copy back to the published content', async () => {
    const { branch } = await seed(lexical('Pub', ['a']))
    await service.update(branch.id, {
      data: lexical('Draft', ['changed']),
      expectedHeadRevisionId: branch.headRevisionId,
    } as never)

    await service.delete(branch.id)

    const view = await service.findById(branch.id)
    expect(view?.status).toBe('active')
    expect(view?.headRevision).toMatchObject({ kind: 'restore', title: 'Pub' })
  })

  it('syncs binary updates and broadcasts the working copy', async () => {
    const { branch } = await seed(lexical('Pub', ['a']))
    const tab = new LoroDoc()
    tab.import(await service.exportCrdt(branch.id))
    const from = tab.oplogVersion()
    tab.import(
      editDocAt(
        tab,
        tab.frontiers(),
        { content: body('a', 'typed'), title: 'Pub' },
        'human:owner',
      ),
    )
    emit.mockClear()

    await service.importCrdt(branch.id, tab.export({ from, mode: 'update' }))
    const { headRevision } = await service.createCheckpoint(branch.id, 'save')

    expect(texts(headRevision.content)).toEqual(['a', 'typed'])
    expect(emit).toHaveBeenCalledWith(
      BusinessEvents.DRAFT_UPDATE,
      expect.objectContaining({ branchId: branch.id }),
      expect.anything(),
    )
  })

  it('merges live article edits into the working copy fields', async () => {
    const { branch, refId } = await seed(lexical('Pub', ['a']))
    await service.findById(branch.id)

    await service.mergeArticleFields(DraftRefType.Post, refId, {
      categoryId: 'cat-2',
      pin: true,
    })
    const view = await service.createCheckpoint(branch.id, 'save')

    expect(view.headRevision.typeSpecificData).toEqual({
      categoryId: 'cat-2',
      pin: true,
      slug: 's',
    })
  })

  it('leaves documents without a Loro doc alone on live edits', async () => {
    const { branch, refId } = await seed(markdown('Md'))

    await service.mergeArticleFields(DraftRefType.Post, refId, { pin: true })

    const view = await service.findById(branch.id)
    expect(view?.headRevision.typeSpecificData).toBeNull()
  })

  it('opens a Lexical draft for editing at a fresh checkpoint', async () => {
    const { branch } = await seed(lexical('Pub', ['a']))
    await service.findById(branch.id)
    await service.updateFields(branch.id, { meta: { cover: 'late.png' } })

    const view = await service.findForEditing(branch.id)

    expect(view?.headRevision.meta).toEqual({ cover: 'late.png' })
    expect((await service.findForEditing(branch.id))?.headRevisionId).toBe(
      view?.headRevisionId,
    )
  })

  it('opens a Markdown draft for editing without touching it', async () => {
    const { branch } = await seed(markdown('Md'))

    const view = await service.findForEditing(branch.id)

    expect(view?.headRevisionId).toBe(branch.headRevisionId)
  })
})
