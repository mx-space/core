import * as schema from '@mx-space/db-schema/schema'
import type { ModuleMetadata } from '@nestjs/common'
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

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { AuthService } from '~/modules/auth/auth.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { ArticlePurchaseRepository } from '~/modules/membership/article-purchase.repository'
import { ArticlePurchaseService } from '~/modules/membership/article-purchase.service'
import { BillingWebhookEventRepository } from '~/modules/membership/billing-webhook-event.repository'
import { EntitlementService } from '~/modules/membership/entitlement.service'
import { MembershipController } from '~/modules/membership/membership.controller'
import { MembershipRepository } from '~/modules/membership/membership.repository'
import { MembershipService } from '~/modules/membership/membership.service'
import { AppleProvider } from '~/modules/membership/providers/apple.provider'
import { DodoProvider } from '~/modules/membership/providers/dodo.provider'
import { PaymentProviderRegistry } from '~/modules/membership/providers/provider.registry'
import { SponsorsService } from '~/modules/membership/sponsors.service'
import { PostRepository } from '~/modules/post/post.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import { createE2EApp } from '../../../helper/create-e2e-app'

const snowflake = new SnowflakeService()

const readerId = snowflake.nextId()
const ownerId = snowflake.nextId()
const premiumPostId = snowflake.nextId()
const publicPostId = snowflake.nextId()
const draftPostId = snowflake.nextId()
const purchaseDisabledPostId = snowflake.nextId()

const readerUser = {
  id: readerId,
  email: 'reader@example.com',
  name: 'Reader One',
  role: 'reader' as const,
}
const ownerUser = {
  id: ownerId,
  email: 'owner@example.com',
  name: 'Owner',
  role: 'owner' as const,
}

const membershipConfig = {
  enabled: false,
  provider: 'dodo' as string | undefined,
  articlePurchaseEnabled: true,
  articleProductId: 'prod_article' as string | undefined,
  apiKey: 'api-key',
  webhookSigningKey: 'webhook-key',
}
const urlConfig: { webUrl: string | undefined } = { webUrl: undefined }

const configsServiceMock = {
  get: vi.fn(async (key: string) => {
    if (key === 'membership') return membershipConfig
    if (key === 'url') return urlConfig
    return {}
  }),
}

const authServiceMock = {
  getSessionUser: vi.fn(async (req: { headers?: Record<string, unknown> }) => {
    const header = req?.headers?.['x-test-reader']
    if (header === 'reader') return { user: readerUser, session: {} }
    if (header === 'owner') return { user: ownerUser, session: {} }
    return null
  }),
}

const createArticleCheckoutMock = vi.fn(async (input: { postId: string }) => ({
  checkoutUrl: `https://checkout.example/article/${input.postId}`,
}))
const getProductPricingMock = vi.fn(async () => ({
  amount: 300,
  currency: 'USD',
}))

const verifyAndParseWebhookMock = vi.fn()

const dodoProviderMock = {
  createCheckout: vi.fn(),
  createArticleCheckout: createArticleCheckoutMock,
  verifyAndParseWebhook: verifyAndParseWebhookMock,
  getProductPricing: getProductPricingMock,
}

const membershipModule: ModuleMetadata = {
  controllers: [MembershipController],
  providers: [
    MembershipService,
    MembershipRepository,
    ArticlePurchaseRepository,
    ArticlePurchaseService,
    BillingWebhookEventRepository,
    EntitlementService,
    SponsorsService,
    PostRepository,
    { provide: SnowflakeService, useValue: snowflake },
    { provide: DodoProvider, useValue: dodoProviderMock },
    { provide: AppleProvider, useValue: {} },
    PaymentProviderRegistry,
    { provide: AuthService, useValue: authServiceMock },
    { provide: ConfigsService, useValue: configsServiceMock },
  ],
}

let pool: Pool
let db: Awaited<ReturnType<typeof createIsolatedPgDatabase>>

beforeAll(async () => {
  db = await createIsolatedPgDatabase()
  pool = new Pool({ connectionString: db.getConnectionUri(), max: 4 })
  const drizzleDb = drizzle(pool, { schema }) as unknown as AppDatabase

  membershipModule.providers!.push({
    provide: PG_DB_TOKEN,
    useValue: drizzleDb,
  })

  await drizzleDb.insert(schema.readers).values([
    { id: readerId, name: 'Reader One', role: 'reader' },
    { id: ownerId, name: 'Owner', role: 'owner' },
  ])
  const categoryId = snowflake.nextId()
  await drizzleDb
    .insert(schema.categories)
    .values({ id: categoryId, name: 'tech', slug: 'tech' })
  await drizzleDb.insert(schema.posts).values([
    {
      id: premiumPostId,
      title: 'premium',
      slug: 'premium',
      contentFormat: 'lexical',
      categoryId,
      isPublished: true,
      isPremium: true,
    },
    {
      id: publicPostId,
      title: 'public',
      slug: 'public',
      contentFormat: 'lexical',
      categoryId,
      isPublished: true,
      isPremium: false,
    },
    {
      id: draftPostId,
      title: 'draft',
      slug: 'draft',
      contentFormat: 'lexical',
      categoryId,
      isPublished: false,
      isPremium: true,
    },
    {
      id: purchaseDisabledPostId,
      title: 'no-purchase',
      slug: 'no-purchase',
      contentFormat: 'lexical',
      categoryId,
      isPublished: true,
      isPremium: true,
      meta: { paywall: { purchaseEnabled: false } },
    },
  ])
}, 120_000)

afterAll(async () => {
  await pool?.end()
  await db?.drop()
})

const proxy = createE2EApp(membershipModule)

const checkout = (postId: string, reader = 'reader', returnPath?: string) =>
  proxy.app.inject({
    method: 'POST',
    url: '/membership/article-checkout',
    headers: { 'x-test-reader': reader, 'content-type': 'application/json' },
    payload: { postId, returnPath },
  })

describe('MembershipController article purchase (e2e)', () => {
  beforeEach(() => {
    membershipConfig.articlePurchaseEnabled = true
    membershipConfig.articleProductId = 'prod_article'
    urlConfig.webUrl = undefined
    createArticleCheckoutMock.mockClear()
  })

  describe('POST /membership/article-checkout', () => {
    it('returns a checkout url and forwards the purchase return url', async () => {
      urlConfig.webUrl = 'https://blog.example.com'

      const res = await checkout(premiumPostId, 'reader', '/posts/tech/premium')

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        data: {
          checkout_url: `https://checkout.example/article/${premiumPostId}`,
        },
      })
      expect(createArticleCheckoutMock).toHaveBeenCalledWith({
        reader: {
          id: readerId,
          email: readerUser.email,
          name: readerUser.name,
        },
        postId: premiumPostId,
        productId: 'prod_article',
        returnUrl:
          'https://blog.example.com/posts/tech/premium?purchase=success',
      })
    })

    it('rejects anonymous callers with 401', async () => {
      const res = await proxy.app.inject({
        method: 'POST',
        url: '/membership/article-checkout',
        headers: { 'content-type': 'application/json' },
        payload: { postId: premiumPostId },
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns ARTICLE_PURCHASE_UNAVAILABLE when the feature is off', async () => {
      membershipConfig.articlePurchaseEnabled = false

      const res = await checkout(premiumPostId)

      expect(res.statusCode).toBe(400)
      expect(res.json().error.code).toBe('ARTICLE_PURCHASE_UNAVAILABLE')
      expect(createArticleCheckoutMock).not.toHaveBeenCalled()
    })

    it('returns POST_NOT_FOUND for an unknown post', async () => {
      const res = await checkout(snowflake.nextId())

      expect(res.statusCode).toBe(404)
      expect(res.json().error.code).toBe('POST_NOT_FOUND')
    })

    it.each([
      ['non-premium', () => publicPostId],
      ['unpublished', () => draftPostId],
      ['purchase-disabled', () => purchaseDisabledPostId],
    ])('returns ARTICLE_NOT_PURCHASABLE for a %s post', async (_, id) => {
      const res = await checkout(id())

      expect(res.statusCode).toBe(400)
      expect(res.json().error.code).toBe('ARTICLE_NOT_PURCHASABLE')
    })

    it('returns ARTICLE_NOT_PURCHASABLE for the owner', async () => {
      const res = await checkout(premiumPostId, 'owner')

      expect(res.statusCode).toBe(400)
      expect(res.json().error.code).toBe('ARTICLE_NOT_PURCHASABLE')
    })

    it('returns ARTICLE_ALREADY_PURCHASED after a paid purchase', async () => {
      await proxy.app.get(ArticlePurchaseRepository).upsertPaid({
        readerId,
        postId: premiumPostId,
        provider: 'dodo',
        providerPaymentId: 'pay_e2e_1',
        amount: 300,
        currency: 'USD',
      })

      const res = await checkout(premiumPostId)

      expect(res.statusCode).toBe(409)
      expect(res.json().error.code).toBe('ARTICLE_ALREADY_PURCHASED')

      await proxy.app
        .get(ArticlePurchaseRepository)
        .markRefunded('dodo', 'pay_e2e_1')
      expect((await checkout(premiumPostId)).statusCode).toBe(200)
    })
  })

  describe('GET /membership/article-purchases/:postId', () => {
    it('reports purchase state for the reader', async () => {
      const get = () =>
        proxy.app.inject({
          method: 'GET',
          url: `/membership/article-purchases/${publicPostId}`,
          headers: { 'x-test-reader': 'reader' },
        })

      expect((await get()).json()).toEqual({ data: { purchased: false } })

      await proxy.app.get(ArticlePurchaseRepository).upsertPaid({
        readerId,
        postId: publicPostId,
        provider: 'dodo',
        providerPaymentId: 'pay_e2e_2',
        amount: 300,
        currency: 'USD',
      })
      expect((await get()).json()).toEqual({ data: { purchased: true } })
    })

    it('rejects anonymous callers with 401', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `/membership/article-purchases/${publicPostId}`,
      })

      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /membership/webhook/:provider', () => {
    it('applies an article paid event and records the purchase', async () => {
      verifyAndParseWebhookMock.mockResolvedValueOnce({
        kind: 'article',
        event: {
          type: 'paid',
          eventId: 'evt_article_1',
          occurredAt: new Date(),
          readerId,
          postId: draftPostId,
          providerPaymentId: 'pay_webhook_1',
          providerCustomerId: 'cus_1',
          amount: 300,
          currency: 'USD',
        },
        rawType: 'payment.succeeded',
        rawPayload: {},
      })

      const res = await proxy.app.inject({
        method: 'POST',
        url: '/membership/webhook/dodo',
        headers: { 'content-type': 'application/json' },
        payload: {},
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ data: { ok: true, applied: true } })
      expect(
        await proxy.app
          .get(ArticlePurchaseService)
          .hasPurchased(readerId, draftPostId),
      ).toBe(true)
    })
  })

  describe('GET /membership/plans', () => {
    it('includes articlePurchase with pricing', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: '/membership/plans',
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data.article_purchase).toEqual({
        enabled: true,
        price: { amount: 300, currency: 'USD' },
      })
    })
  })
})
