import * as schema from '@mx-space/db-schema/schema'
import type { ModuleMetadata } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { RolesGuard } from '~/common/guards/roles.guard'
import { PG_DB_TOKEN } from '~/constants/system.constant'
import { AiInsightsService } from '~/modules/ai/ai-insights/ai-insights.service'
import { AiSummaryService } from '~/modules/ai/ai-summary/ai-summary.service'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import { AuthService } from '~/modules/auth/auth.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { EnrichmentService } from '~/modules/enrichment/enrichment.service'
import { EntitlementService } from '~/modules/membership/entitlement.service'
import { MembershipRepository } from '~/modules/membership/membership.repository'
import { PostController } from '~/modules/post/post.controller'
import { PostService } from '~/modules/post/post.service'
import { SnippetService } from '~/modules/snippet/snippet.service'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { TranslationService } from '~/processors/helper/helper.translation.service'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import { createE2EApp } from '../../../helper/create-e2e-app'

const snowflake = new SnowflakeService()

const ownerReaderId = snowflake.nextId()
const nonMemberReaderId = snowflake.nextId()
const activeMemberReaderId = snowflake.nextId()
const onHoldMemberReaderId = snowflake.nextId()
const expiredMemberReaderId = snowflake.nextId()

function textNode(text: string) {
  return {
    detail: 0,
    format: 0,
    mode: 'normal',
    style: '',
    text,
    type: 'text',
    version: 1,
  }
}

function paragraph(text: string) {
  return {
    children: [textNode(text)],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'paragraph',
    version: 1,
  }
}

function editorState(blocks: string[]) {
  return JSON.stringify({
    root: {
      children: blocks.map((text) => paragraph(text)),
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  })
}

const FIVE_BLOCKS = ['one', 'two', 'three', 'four', 'five']
const THREE_BLOCKS = ['alpha', 'beta', 'gamma']
const ONE_BLOCK = ['solo']

const premiumPostFixture = {
  id: '7100000000000000001',
  title: 'Premium Post',
  slug: 'premium-post',
  text: FIVE_BLOCKS.join('\n\n'),
  content: editorState(FIVE_BLOCKS),
  contentFormat: 'lexical',
  summary: null,
  tags: [],
  meta: null,
  modifiedAt: null,
  createdAt: new Date('2024-01-01'),
  category: { id: '9100000000000000001', name: 'Tech', slug: 'tech', type: 1 },
  isPublished: true,
  isPremium: true,
  related: [],
}

const boundaryPostFixture = {
  ...premiumPostFixture,
  id: '7100000000000000002',
  slug: 'premium-boundary-post',
  text: THREE_BLOCKS.join('\n\n'),
  content: editorState(THREE_BLOCKS),
}

const oneBlockPostFixture = {
  ...premiumPostFixture,
  id: '7100000000000000004',
  slug: 'premium-one-block-post',
  text: ONE_BLOCK.join('\n\n'),
  content: editorState(ONE_BLOCK),
}

const freePostFixture = {
  ...premiumPostFixture,
  id: '7100000000000000003',
  slug: 'free-post',
  isPremium: false,
  contentFormat: 'markdown',
  content: null,
  text: 'plain markdown body',
}

let currentPost: Record<string, unknown> | null = premiumPostFixture
let currentListData: Record<string, unknown>[] = []

const postService = {
  findById: vi.fn(async () => currentPost),
  getPostBySlug: vi.fn(async () => currentPost),
  listPaginated: vi.fn(async () => ({
    data: currentListData.map((doc) => ({ ...doc })),
    pagination: {
      currentPage: 1,
      size: currentListData.length,
      total: currentListData.length,
      totalPage: 1,
    },
  })),
}

const readerRoleById: Record<string, { id: string; role: 'reader' | 'owner' }> =
  {
    [ownerReaderId]: { id: ownerReaderId, role: 'owner' },
    [nonMemberReaderId]: { id: nonMemberReaderId, role: 'reader' },
    [activeMemberReaderId]: { id: activeMemberReaderId, role: 'reader' },
    [onHoldMemberReaderId]: { id: onHoldMemberReaderId, role: 'reader' },
    [expiredMemberReaderId]: { id: expiredMemberReaderId, role: 'reader' },
  }

const authServiceMock = {
  getSessionUser: vi.fn(async (req: { headers?: Record<string, unknown> }) => {
    const readerId = req?.headers?.['x-test-reader-id'] as string | undefined
    if (!readerId) return null
    const user = readerRoleById[readerId]
    if (!user) return null
    return { user, session: { token: `${readerId}-token` } }
  }),
  getApiKeyFromRequest: vi.fn(() => undefined),
}

const postModule: ModuleMetadata = {
  controllers: [PostController],
  providers: [
    { provide: PostService, useValue: postService },
    {
      provide: CountingService,
      useValue: { getThisRecordIsLiked: vi.fn(async () => false) },
    },
    {
      provide: TranslationService,
      useValue: {
        translateArticle: vi.fn(async () => ({
          isTranslated: false,
          title: '',
          text: '',
          summary: null,
          tags: [],
          sourceLang: 'zh',
          availableTranslations: [],
        })),
        collectArticleTranslations: vi.fn(async () => ({
          results: new Map(),
          meta: new Map(),
        })),
        getCachedTitles: vi.fn(async () => new Map()),
      },
    },
    {
      provide: AiInsightsService,
      useValue: { hasInsightsInLang: vi.fn(async () => false) },
    },
    {
      provide: AiSummaryService,
      useValue: { getSummaryForPublicMeta: vi.fn(async () => null) },
    },
    {
      provide: EnrichmentService,
      useValue: {
        attachEnrichments: vi.fn(async (doc: Record<string, unknown>) => ({
          enrichments: {},
          ...doc,
        })),
      },
    },
    {
      provide: TranslationEntryService,
      useValue: {
        getTranslationsBatch: vi.fn(async () => ({
          entityMaps: new Map(),
          dictMaps: new Map(),
        })),
      },
    },
    {
      provide: SnippetService,
      useValue: { findSkillBundlesByIds: vi.fn(async () => []) },
    },
    EntitlementService,
    MembershipRepository,
    { provide: SnowflakeService, useValue: snowflake },
    { provide: AuthService, useValue: authServiceMock },
    { provide: ConfigsService, useValue: {} },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
}

let pool: Pool
let db: Awaited<ReturnType<typeof createIsolatedPgDatabase>>

beforeAll(async () => {
  db = await createIsolatedPgDatabase()
  pool = new Pool({ connectionString: db.getConnectionUri(), max: 4 })
  const drizzleDb = drizzle(pool, { schema }) as unknown as AppDatabase

  postModule.providers!.push({ provide: PG_DB_TOKEN, useValue: drizzleDb })

  await drizzleDb.insert(schema.readers).values([
    { id: ownerReaderId, name: 'Owner', role: 'owner' },
    { id: nonMemberReaderId, name: 'Non Member', role: 'reader' },
    { id: activeMemberReaderId, name: 'Active Member', role: 'reader' },
    { id: onHoldMemberReaderId, name: 'On Hold Member', role: 'reader' },
    { id: expiredMemberReaderId, name: 'Expired Member', role: 'reader' },
  ])

  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000)

  await drizzleDb.insert(schema.memberships).values([
    {
      id: snowflake.nextId(),
      readerId: activeMemberReaderId,
      provider: 'manual',
      plan: 'monthly',
      status: 'active',
      currentPeriodEnd: future,
    },
    {
      id: snowflake.nextId(),
      readerId: onHoldMemberReaderId,
      provider: 'manual',
      plan: 'monthly',
      status: 'on_hold',
      currentPeriodEnd: future,
    },
    {
      id: snowflake.nextId(),
      readerId: expiredMemberReaderId,
      provider: 'manual',
      plan: 'monthly',
      status: 'active',
      currentPeriodEnd: past,
    },
  ])
}, 120_000)

afterAll(async () => {
  await pool?.end()
  await db?.drop()
})

const proxy = createE2EApp(postModule)

const headerFor = (readerId?: string) =>
  readerId ? { 'x-test-reader-id': readerId } : {}

describe('Post paywall enforcement (e2e)', () => {
  describe('entitlement matrix on a premium lexical post', () => {
    it.each([
      ['anonymous', undefined, true],
      ['non-member reader', nonMemberReaderId, true],
      ['active member', activeMemberReaderId, false],
      ['on_hold member', onHoldMemberReaderId, false],
      ['expired member', expiredMemberReaderId, true],
      ['owner', ownerReaderId, false],
    ])('%s -> locked=%s', async (_label, readerId, expectedLocked) => {
      currentPost = { ...premiumPostFixture }

      const res = await proxy.app.inject({
        method: 'GET',
        url: `/posts/${premiumPostFixture.category.slug}/${premiumPostFixture.slug}`,
        headers: headerFor(readerId),
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.meta.paywall.locked).toBe(expectedLocked)

      if (expectedLocked) {
        expect(body.meta.paywall.preview_blocks).toBe(3)
        const truncatedContent = JSON.parse(body.data.content)
        expect(truncatedContent.root.children).toHaveLength(3)
        expect(body.data.text).toBe('one\n\ntwo\n\nthree')
      } else {
        expect(body.meta.paywall.preview_blocks).toBeUndefined()
        const fullContent = JSON.parse(body.data.content)
        expect(fullContent.root.children).toHaveLength(5)
        expect(body.data.text).toBe(FIVE_BLOCKS.join('\n\n'))
      }
    })
  })

  it('boundary: a post with exactly N=3 blocks is a strict subset (2 blocks, locked:true) for a non-member', async () => {
    currentPost = { ...boundaryPostFixture }

    const res = await proxy.app.inject({
      method: 'GET',
      url: `/posts/${boundaryPostFixture.category.slug}/${boundaryPostFixture.slug}`,
      headers: headerFor(nonMemberReaderId),
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.meta.paywall.locked).toBe(true)
    expect(body.meta.paywall.preview_blocks).toBe(2)
    const truncatedContent = JSON.parse(body.data.content)
    expect(truncatedContent.root.children).toHaveLength(2)
    expect(body.data.text).toBe('alpha\n\nbeta')
  })

  it('a 1-block premium post yields an empty preview, still locked:true for a non-member', async () => {
    currentPost = { ...oneBlockPostFixture }

    const res = await proxy.app.inject({
      method: 'GET',
      url: `/posts/${oneBlockPostFixture.category.slug}/${oneBlockPostFixture.slug}`,
      headers: headerFor(nonMemberReaderId),
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.meta.paywall.locked).toBe(true)
    expect(body.meta.paywall.preview_blocks).toBe(0)
    const truncatedContent = JSON.parse(body.data.content)
    expect(truncatedContent.root.children).toHaveLength(0)
    expect(body.data.text).toBe('')
  })

  it('non-premium post carries no paywall meta', async () => {
    currentPost = { ...freePostFixture }

    const res = await proxy.app.inject({
      method: 'GET',
      url: `/posts/${freePostFixture.category.slug}/${freePostFixture.slug}`,
      headers: headerFor(nonMemberReaderId),
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.meta.paywall).toBeUndefined()
  })

  it('getById applies the same gate for a non-member reader', async () => {
    currentPost = { ...premiumPostFixture }

    const res = await proxy.app.inject({
      method: 'GET',
      url: `/posts/${premiumPostFixture.id}`,
      headers: headerFor(nonMemberReaderId),
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.meta.paywall.locked).toBe(true)
    expect(body.meta.paywall.preview_blocks).toBe(3)
  })

  describe('GET /posts list route always teasers premium rows', () => {
    it('without ?truncate: premium row content/text are teasers, non-premium row is untouched', async () => {
      currentListData = [{ ...premiumPostFixture }, { ...freePostFixture }]

      const res = await proxy.app.inject({ method: 'GET', url: '/posts' })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      const premiumRow = body.data.find(
        (row: any) => row.id === premiumPostFixture.id,
      )
      const freeRow = body.data.find(
        (row: any) => row.id === freePostFixture.id,
      )

      const truncatedContent = JSON.parse(premiumRow.content)
      expect(truncatedContent.root.children).toHaveLength(3)
      expect(premiumRow.text).toBe('one\n\ntwo\n\nthree')

      expect(freeRow.content).toBe(freePostFixture.content)
      expect(freeRow.text).toBe(freePostFixture.text)
    })

    it('with ?truncate: premium row is still a teaser (not the client-controlled slice), non-premium row is nulled/sliced as before', async () => {
      currentListData = [{ ...premiumPostFixture }, { ...freePostFixture }]

      const res = await proxy.app.inject({
        method: 'GET',
        url: '/posts?truncate=500',
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      const premiumRow = body.data.find(
        (row: any) => row.id === premiumPostFixture.id,
      )
      const freeRow = body.data.find(
        (row: any) => row.id === freePostFixture.id,
      )

      const truncatedContent = JSON.parse(premiumRow.content)
      expect(truncatedContent.root.children).toHaveLength(3)
      expect(premiumRow.text).toBe('one\n\ntwo\n\nthree')
      expect(premiumRow.text).not.toBe(premiumPostFixture.text)

      expect(freeRow.content).toBeNull()
      expect(freeRow.text).toBe(freePostFixture.text.slice(0, 500))
    })
  })
})
