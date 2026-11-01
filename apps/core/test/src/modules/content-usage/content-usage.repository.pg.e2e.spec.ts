import { SnowflakeGenerator } from '@mx-space/db-schema/id'
import * as schema from '@mx-space/db-schema/schema'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ContentUsageRepository } from '~/modules/content-usage/content-usage.repository'
import type { ContentUsage } from '~/modules/content-usage/content-usage.types'
import { DraftRefType } from '~/modules/draft/draft.enum'
import { DraftRepository } from '~/modules/draft/draft.repository'
import type { RevisionSnapshot } from '~/modules/draft/draft.types'
import { createContentDoc } from '~/modules/draft/draft-crdt.doc'
import { DraftCrdtRepository } from '~/modules/draft/draft-crdt.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import type { SnowflakeService } from '~/shared/id/snowflake.service'

const base = 'https://cdn.test/versions'
const url = (name: string) => `${base}/${name}.js`
const URLS = {
  post: url('a-post'),
  translation: url('b-translation'),
  draftHead: url('c-draft-head'),
  live: url('d-live'),
  snippet: url('e-snippet'),
  history: url('f-history'),
  nowhere: url('g-nowhere'),
}

const snapshot = (title: string, text: string): RevisionSnapshot => ({
  content: null,
  contentFormat: 'markdown',
  images: null,
  meta: null,
  text,
  title,
  typeSpecificData: null,
})

const lexicalWithText = (text: string) =>
  JSON.stringify({
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              text,
              type: 'text',
              version: 1,
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          type: 'paragraph',
          version: 1,
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  })

describe('ContentUsageRepository (real PG)', () => {
  let pool: Pool
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let db: AppDatabase
  let usage: ContentUsageRepository
  let result: Map<string, ContentUsage>

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 4 })
    db = drizzle(pool, { schema }) as unknown as AppDatabase
    const snowflake = new SnowflakeGenerator({
      workerId: 51,
    }) as SnowflakeService
    const drafts = new DraftRepository(db, snowflake)
    const crdt = new DraftCrdtRepository(db, snowflake)
    usage = new ContentUsageRepository(db)

    await db.insert(schema.categories).values({
      id: '1001',
      name: 'Fixture',
      slug: 'fixture',
    })
    await db.insert(schema.posts).values({
      id: '1002',
      categoryId: '1001',
      contentFormat: 'markdown',
      slug: 'fixture-post',
      text: `Chart below\n\n${URLS.post}`,
      title: 'Fixture post',
    })
    await db.insert(schema.aiTranslations).values({
      id: '1003',
      hash: 'h',
      lang: 'en',
      refId: '1002',
      refType: 'post',
      sourceLang: 'zh',
      text: `see ${URLS.translation}`,
      title: 'Fixture post (en)',
    })
    await db.insert(schema.snippets).values([
      {
        id: '1004',
        path: 'dynamic-widgets-catalog',
        raw: JSON.stringify({
          version: 1,
          components: Object.values(URLS).map((u) => ({ url: u })),
        }),
        type: 'json',
      },
      {
        id: '1005',
        path: 'fixture-snippet',
        raw: `embed: ${URLS.snippet}`,
        type: 'text',
      },
    ])

    const headDoc = await drafts.createDocumentWithRoot(
      DraftRefType.Post,
      null,
      snapshot('Head draft', 'root'),
      false,
    )
    await drafts.createBranch(
      headDoc.document.id,
      headDoc.revision.id,
      snapshot('Head draft', `uses ${URLS.draftHead}`),
      false,
    )

    const liveDoc = await drafts.createDocumentWithRoot(
      DraftRefType.Post,
      null,
      snapshot('Live draft', 'root'),
      false,
    )
    const live = await drafts.createBranch(
      liveDoc.document.id,
      liveDoc.revision.id,
      snapshot('Live draft', 'saved text'),
      false,
    )
    const doc = createContentDoc(
      {
        content: lexicalWithText(`now with ${URLS.live}`),
        title: 'Live draft',
      },
      'test',
    )
    await crdt.createDoc({
      documentId: liveDoc.document.id,
      fields: {},
      snapshot: doc.export({ mode: 'snapshot' }),
      snapshotVersion: doc.oplogVersion().encode(),
      syncedRevisionId: live.headRevision.id,
    })
    await db
      .update(schema.contentCrdtDocs)
      .set({ editedAt: sql`now() + interval '1 minute'` })
      .where(eq(schema.contentCrdtDocs.documentId, liveDoc.document.id))

    const historyDoc = await drafts.createDocumentWithRoot(
      DraftRefType.Post,
      null,
      snapshot('History draft', `old ${URLS.history}`),
      false,
    )
    await drafts.createBranch(
      historyDoc.document.id,
      historyDoc.revision.id,
      snapshot('History draft', 'rewritten without it'),
      false,
    )

    const rows = await usage.findUsage(Object.values(URLS))
    result = new Map(rows.map((row) => [row.url, row]))
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('reports published post content', () => {
    expect(result.get(URLS.post)?.published).toEqual([
      expect.objectContaining({
        id: '1002',
        title: 'Fixture post',
        type: 'post',
      }),
    ])
  })

  it('reports translations as published', () => {
    expect(result.get(URLS.translation)?.published).toEqual([
      expect.objectContaining({ type: 'translation' }),
    ])
  })

  it('reports the head of an active draft', () => {
    expect(result.get(URLS.draftHead)?.drafts).toEqual([
      expect.objectContaining({ live: false, title: 'Head draft' }),
    ])
    expect(result.get(URLS.draftHead)?.published).toEqual([])
  })

  it('reports live collaborative content newer than the head', () => {
    expect(result.get(URLS.live)?.drafts).toEqual([
      expect.objectContaining({ live: true }),
    ])
  })

  it('reports other snippets but never the catalog snippet', () => {
    expect(result.get(URLS.snippet)?.other).toEqual([
      expect.objectContaining({ id: '1005', type: 'snippet' }),
    ])
    expect(result.get(URLS.nowhere)?.other).toEqual([])
  })

  it('marks URLs found only in older revisions as history only', () => {
    const history = result.get(URLS.history)
    expect(history?.historyOnly).toBe(true)
    expect(history?.drafts).toEqual([])
  })

  it('reports nothing for a URL used nowhere', () => {
    expect(result.get(URLS.nowhere)).toEqual(
      expect.objectContaining({
        drafts: [],
        historyOnly: false,
        other: [],
        published: [],
      }),
    )
  })
})
