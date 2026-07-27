import * as schema from '@mx-space/db-schema/schema'
import type { ModuleMetadata } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { AggregateController } from '~/modules/aggregate/aggregate.controller'
import { AggregateService } from '~/modules/aggregate/aggregate.service'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import { AnalyzeService } from '~/modules/analyze/analyze.service'
import { CommentState } from '~/modules/comment/comment.enum'
import { CommentRepository } from '~/modules/comment/comment.repository'
import { CommentService } from '~/modules/comment/comment.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { LinkRepository } from '~/modules/link/link.repository'
import { LinkService } from '~/modules/link/link.service'
import { LinkState } from '~/modules/link/link.types'
import { NoteRepository } from '~/modules/note/note.repository'
import { NoteService } from '~/modules/note/note.service'
import { OwnerService } from '~/modules/owner/owner.service'
import { PageRepository } from '~/modules/page/page.repository'
import { PostRepository } from '~/modules/post/post.repository'
import { RecentlyRepository } from '~/modules/recently/recently.repository'
import { SnippetService } from '~/modules/snippet/snippet.service'
import { DatabaseService } from '~/processors/database/database.service'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { TranslationService } from '~/processors/helper/helper.translation.service'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import { createE2EApp } from '../../../helper/create-e2e-app'
import { authPassHeader } from '../../../mock/guard/auth.guard'

const snowflake = new SnowflakeService()

const categoryId = snowflake.nextId()
const postId = snowflake.nextId()
const unreadCommentId = snowflake.nextId()
const readCommentId = snowflake.nextId()
const auditLinkId = snowflake.nextId()
const approvedLinkId = snowflake.nextId()
const scheduledNoteId = snowflake.nextId()
const publishedNoteId = snowflake.nextId()
const unpublishedFutureNoteId = snowflake.nextId()

const onThisDayPostId = snowflake.nextId()
const onThisDayNoteId = snowflake.nextId()

const futurePublicAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
const pastPublicAt = new Date(Date.now() - 24 * 60 * 60 * 1000)

const now = new Date()
const twoYearsAgoToday = new Date(now)
twoYearsAgoToday.setFullYear(now.getFullYear() - 2)
const threeYearsAgoToday = new Date(now)
threeYearsAgoToday.setFullYear(now.getFullYear() - 3)
const onThisDayPostText = 'a'.repeat(100)

const aggregateModule: ModuleMetadata = {
  controllers: [AggregateController],
  providers: [
    { provide: ConfigsService, useValue: {} },
    { provide: AnalyzeService, useValue: {} },
    { provide: NoteService, useValue: {} },
    { provide: SnippetService, useValue: {} },
    { provide: OwnerService, useValue: {} },
    { provide: TranslationService, useValue: {} },
    { provide: TranslationEntryService, useValue: {} },
  ],
}

let pool: Pool
let db: Awaited<ReturnType<typeof createIsolatedPgDatabase>>

beforeAll(async () => {
  db = await createIsolatedPgDatabase()
  pool = new Pool({ connectionString: db.getConnectionUri(), max: 4 })
  const drizzleDb = drizzle(pool, { schema }) as unknown as AppDatabase

  await drizzleDb.insert(schema.categories).values({
    id: categoryId,
    name: 'Desk Category',
    slug: 'desk-category',
  })
  await drizzleDb.insert(schema.posts).values([
    {
      id: postId,
      title: 'Why the Desk Endpoint Matters',
      slug: 'why-the-desk-endpoint-matters',
      contentFormat: 'markdown',
      categoryId,
    },
    {
      id: onThisDayPostId,
      title: 'Two Years Ago Today',
      slug: 'two-years-ago-today',
      text: onThisDayPostText,
      contentFormat: 'markdown',
      categoryId,
      createdAt: twoYearsAgoToday,
    },
  ])
  await drizzleDb.insert(schema.comments).values([
    {
      id: unreadCommentId,
      refType: 'post',
      refId: postId,
      author: 'Jane Reader',
      text: 'Great write-up!',
      state: CommentState.Unread,
    },
    {
      id: readCommentId,
      refType: 'post',
      refId: postId,
      author: 'Older Reader',
      text: 'Already triaged',
      state: CommentState.Read,
    },
  ])
  await drizzleDb.insert(schema.links).values([
    {
      id: auditLinkId,
      name: 'Applicant Blog',
      url: 'https://applicant.example.com',
      state: LinkState.Audit,
    },
    {
      id: approvedLinkId,
      name: 'Approved Blog',
      url: 'https://approved.example.com',
      state: LinkState.Pass,
    },
  ])
  await drizzleDb.insert(schema.notes).values([
    {
      id: scheduledNoteId,
      title: 'Draft for next week',
      text: 'scheduled body',
      contentFormat: 'markdown',
      isPublished: true,
      publicAt: futurePublicAt,
    },
    {
      id: publishedNoteId,
      title: 'Already live',
      text: 'already public body',
      contentFormat: 'markdown',
      isPublished: true,
      publicAt: pastPublicAt,
    },
    {
      id: unpublishedFutureNoteId,
      title: 'Unpublished future note',
      text: 'unpublished body',
      contentFormat: 'markdown',
      isPublished: false,
      publicAt: futurePublicAt,
    },
    {
      id: onThisDayNoteId,
      title: 'Three Years Ago Today',
      text: 'that day note body',
      contentFormat: 'markdown',
      isPublished: true,
      createdAt: threeYearsAgoToday,
    },
  ])

  const commentRepository = new CommentRepository(drizzleDb, snowflake)
  const linkRepository = new LinkRepository(drizzleDb, snowflake)
  const noteRepository = new NoteRepository(drizzleDb, snowflake)
  const postRepository = new PostRepository(drizzleDb, snowflake)
  const pageRepository = new PageRepository(drizzleDb, snowflake)
  const recentlyRepository = new RecentlyRepository(drizzleDb, snowflake)

  const databaseService = new DatabaseService(
    postRepository,
    noteRepository,
    pageRepository,
    recentlyRepository,
  )

  const commentService = new CommentService(
    commentRepository,
    databaseService,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  )

  const linkService = new LinkService(
    linkRepository,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  )

  const noteService = new NoteService(
    noteRepository,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    commentService,
    {} as any,
  )

  const aggregateService = new AggregateService(
    { repository: postRepository } as any,
    noteService,
    {} as any,
    {} as any,
    {} as any,
    commentService,
    linkService,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  )

  aggregateModule.providers!.push({
    provide: AggregateService,
    useValue: aggregateService,
  })
}, 120_000)

afterAll(async () => {
  await pool?.end()
  await db?.drop()
})

const proxy = createE2EApp(aggregateModule)

describe('AggregateController — GET /aggregate/desk (e2e)', () => {
  it('rejects anonymous callers with 401', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/desk`,
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns unread comments, link applications, and scheduled notes', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/desk`,
      headers: authPassHeader,
    })

    expect(res.statusCode).toBe(200)
    const { data } = res.json()

    expect(data.unread_comments).toMatchObject({
      count: 1,
      latest: {
        id: unreadCommentId,
        author: 'Jane Reader',
        text: 'Great write-up!',
        ref_title: 'Why the Desk Endpoint Matters',
      },
    })

    expect(data.link_applications).toMatchObject({
      count: 1,
      latest: {
        id: auditLinkId,
        name: 'Applicant Blog',
        url: 'https://applicant.example.com',
      },
    })

    expect(data.scheduled_notes).toHaveLength(1)
    expect(data.scheduled_notes[0]).toMatchObject({
      id: scheduledNoteId,
      title: 'Draft for next week',
      public_at: futurePublicAt.toISOString(),
    })
    expect(typeof data.scheduled_notes[0].nid).toBe('number')
  })
})

describe('AggregateController — GET /aggregate/on-this-day (e2e)', () => {
  it('rejects anonymous callers with 401', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/on-this-day`,
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns prior-year entries newest first, excluding this year', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/on-this-day`,
      headers: authPassHeader,
    })

    expect(res.statusCode).toBe(200)
    const { data } = res.json()

    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({
      id: onThisDayPostId,
      type: 'post',
      title: 'Two Years Ago Today',
      excerpt: 'a'.repeat(80),
    })
    expect(data[1]).toMatchObject({
      id: onThisDayNoteId,
      type: 'note',
      title: 'Three Years Ago Today',
      excerpt: 'that day note body',
    })
    expect(data.some((entry: any) => entry.id === postId)).toBe(false)
  })
})

describe('AggregateController — GET /aggregate/publish-heatmap (e2e)', () => {
  it('rejects anonymous callers with 401', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/publish-heatmap`,
    })

    expect(res.statusCode).toBe(401)
  })

  it('counts published posts and notes per day within the trailing year', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/aggregate/publish-heatmap`,
      headers: authPassHeader,
    })

    expect(res.statusCode).toBe(200)
    const { data } = res.json()

    expect(data).toHaveLength(1)
    expect(data[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(data[0].count).toBe(3)
  })
})
