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

import { AppErrorCode, createAppException } from '~/common/errors'
import { PG_DB_TOKEN } from '~/constants/system.constant'
import { AuthService } from '~/modules/auth/auth.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { BillingWebhookEventRepository } from '~/modules/membership/billing-webhook-event.repository'
import { EntitlementService } from '~/modules/membership/entitlement.service'
import { MembershipController } from '~/modules/membership/membership.controller'
import { MembershipRepository } from '~/modules/membership/membership.repository'
import { MembershipService } from '~/modules/membership/membership.service'
import { DodoProvider } from '~/modules/membership/providers/dodo.provider'
import { PaymentProviderRegistry } from '~/modules/membership/providers/provider.registry'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import { createE2EApp } from '../../../helper/create-e2e-app'

const snowflake = new SnowflakeService()

const readerId = snowflake.nextId()
const otherReaderId = snowflake.nextId()
const liveSubReaderId = snowflake.nextId()
const expiredReaderId = snowflake.nextId()
const checkoutActiveReaderId = snowflake.nextId()
const checkoutExpiredReaderId = snowflake.nextId()

const readerUser = {
  id: readerId,
  email: 'reader@example.com',
  name: 'Reader One',
  role: 'reader' as const,
}

const expiredReaderUser = {
  id: expiredReaderId,
  email: 'expired-reader@example.com',
  name: 'Reader Expired',
  role: 'reader' as const,
}

const checkoutActiveReaderUser = {
  id: checkoutActiveReaderId,
  email: 'checkout-active@example.com',
  name: 'Reader Checkout Active',
  role: 'reader' as const,
}

const checkoutExpiredReaderUser = {
  id: checkoutExpiredReaderId,
  email: 'checkout-expired@example.com',
  name: 'Reader Checkout Expired',
  role: 'reader' as const,
}

const membershipConfig: {
  enabled: boolean
  provider: string | undefined
  monthlyProductId: string
  yearlyProductId: string
} = {
  enabled: true,
  provider: 'dodo',
  monthlyProductId: 'prod_monthly',
  yearlyProductId: 'prod_yearly',
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
    if (header === 'reader') {
      return { user: readerUser, session: { token: 'reader-token' } }
    }
    if (header === 'expired-reader') {
      return { user: expiredReaderUser, session: { token: 'expired-token' } }
    }
    if (header === 'checkout-active') {
      return {
        user: checkoutActiveReaderUser,
        session: { token: 'checkout-active-token' },
      }
    }
    if (header === 'checkout-expired') {
      return {
        user: checkoutExpiredReaderUser,
        session: { token: 'checkout-expired-token' },
      }
    }
    return null
  }),
}

const createCheckoutMock = vi.fn(
  async (input: { reader: { id: string }; plan: string }) => ({
    checkoutUrl: `https://checkout.example/${input.plan}/${input.reader.id}`,
  }),
)

const verifyAndParseWebhookMock = vi.fn(
  async (rawBody: Buffer, headers: Record<string, string>) => {
    if (headers['x-signature'] !== 'valid') {
      throw createAppException(AppErrorCode.WEBHOOK_VERIFY_FAILED)
    }
    const body = JSON.parse(rawBody.toString('utf8'))
    return {
      eventId: body.eventId,
      provider: 'dodo',
      type: body.type,
      customerId: body.customerId,
      subscriptionId: body.subscriptionId,
      plan: body.plan,
      currentPeriodEnd: new Date(body.currentPeriodEnd),
      readerId: body.readerId,
    }
  },
)

const getPlanPricingMock = vi.fn(async (productId: string) => ({
  amount: productId === 'prod_monthly' ? 500 : 5000,
  currency: 'USD',
  interval: productId === 'prod_monthly' ? 'month' : 'year',
  intervalCount: 1,
}))

const dodoProviderMock = {
  createCheckout: createCheckoutMock,
  verifyAndParseWebhook: verifyAndParseWebhookMock,
  getPlanPricing: getPlanPricingMock,
}

const membershipModule: ModuleMetadata = {
  controllers: [MembershipController],
  providers: [
    MembershipService,
    MembershipRepository,
    BillingWebhookEventRepository,
    EntitlementService,
    { provide: SnowflakeService, useValue: snowflake },
    { provide: DodoProvider, useValue: dodoProviderMock },
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
    { id: otherReaderId, name: 'Reader Two', role: 'reader' },
    { id: liveSubReaderId, name: 'Reader Three', role: 'reader' },
    { id: expiredReaderId, name: 'Reader Expired', role: 'reader' },
    { id: checkoutActiveReaderId, name: 'Checkout Active', role: 'reader' },
    { id: checkoutExpiredReaderId, name: 'Checkout Expired', role: 'reader' },
  ])
}, 120_000)

afterAll(async () => {
  await pool?.end()
  await db?.drop()
})

const proxy = createE2EApp(membershipModule)

describe('MembershipController (e2e)', () => {
  beforeEach(() => {
    membershipConfig.enabled = true
    membershipConfig.provider = 'dodo'
    urlConfig.webUrl = undefined
    createCheckoutMock.mockClear()
    verifyAndParseWebhookMock.mockClear()
  })

  describe('POST /membership/checkout', () => {
    it('returns a checkout url for an authenticated reader', async () => {
      const res = await proxy.app.inject({
        method: 'POST',
        url: '/membership/checkout',
        headers: {
          'x-test-reader': 'reader',
          'content-type': 'application/json',
        },
        payload: { plan: 'monthly' },
      })

      expect(res.statusCode).toBe(201)
      expect(res.json()).toMatchObject({
        data: { checkout_url: expect.stringContaining('monthly') },
      })
      expect(createCheckoutMock).toHaveBeenCalledWith({
        reader: {
          id: readerId,
          email: readerUser.email,
          name: readerUser.name,
        },
        plan: 'monthly',
      })
    })

    it('resolves returnPath against webUrl and forwards it to the adapter', async () => {
      urlConfig.webUrl = 'https://blog.example.com'

      const res = await proxy.app.inject({
        method: 'POST',
        url: '/membership/checkout',
        headers: {
          'x-test-reader': 'reader',
          'content-type': 'application/json',
        },
        payload: { plan: 'monthly', returnPath: '/posts/tech/foo' },
      })

      expect(res.statusCode).toBe(201)
      expect(createCheckoutMock).toHaveBeenCalledWith(
        expect.objectContaining({
          returnUrl:
            'https://blog.example.com/posts/tech/foo?membership=success',
        }),
      )
    })

    it('drops an off-origin returnPath (open redirect guard)', async () => {
      urlConfig.webUrl = 'https://blog.example.com'

      const res = await proxy.app.inject({
        method: 'POST',
        url: '/membership/checkout',
        headers: {
          'x-test-reader': 'reader',
          'content-type': 'application/json',
        },
        payload: { plan: 'monthly', returnPath: '//evil.com/phish' },
      })

      expect(res.statusCode).toBe(201)
      expect(createCheckoutMock).toHaveBeenCalledWith(
        expect.objectContaining({ returnUrl: undefined }),
      )
    })

    it('refuses checkout when the reader already has a live membership', async () => {
      const membershipRepository = proxy.app.get(MembershipRepository)
      await membershipRepository.create({
        readerId: checkoutActiveReaderId,
        provider: 'dodo',
        providerCustomerId: 'cus_checkout_active',
        providerSubscriptionId: 'sub_checkout_active',
        plan: 'monthly',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })

      const res = await proxy.app.inject({
        method: 'POST',
        url: '/membership/checkout',
        headers: {
          'x-test-reader': 'checkout-active',
          'content-type': 'application/json',
        },
        payload: { plan: 'monthly' },
      })

      expect(res.statusCode).toBe(409)
      expect(res.json()).toMatchObject({
        error: { code: 'MEMBERSHIP_ALREADY_ACTIVE' },
      })
      expect(createCheckoutMock).not.toHaveBeenCalled()
    })

    it('allows checkout again after the stored membership has expired', async () => {
      const membershipRepository = proxy.app.get(MembershipRepository)
      await membershipRepository.create({
        readerId: checkoutExpiredReaderId,
        provider: 'dodo',
        providerCustomerId: 'cus_checkout_expired',
        providerSubscriptionId: 'sub_checkout_expired',
        plan: 'monthly',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })

      const res = await proxy.app.inject({
        method: 'POST',
        url: '/membership/checkout',
        headers: {
          'x-test-reader': 'checkout-expired',
          'content-type': 'application/json',
        },
        payload: { plan: 'monthly' },
      })

      expect(res.statusCode).toBe(201)
      expect(createCheckoutMock).toHaveBeenCalled()
    })

    it('rejects anonymous callers with 401', async () => {
      const res = await proxy.app.inject({
        method: 'POST',
        url: '/membership/checkout',
        headers: { 'content-type': 'application/json' },
        payload: { plan: 'monthly' },
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns MEMBERSHIP_PROVIDER_NOT_CONFIGURED when membership is disabled', async () => {
      membershipConfig.enabled = false

      const res = await proxy.app.inject({
        method: 'POST',
        url: '/membership/checkout',
        headers: {
          'x-test-reader': 'reader',
          'content-type': 'application/json',
        },
        payload: { plan: 'monthly' },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({
        error: { code: 'MEMBERSHIP_PROVIDER_NOT_CONFIGURED' },
      })
      expect(createCheckoutMock).not.toHaveBeenCalled()
    })

    it('returns MEMBERSHIP_PROVIDER_NOT_CONFIGURED when no provider is chosen', async () => {
      membershipConfig.provider = undefined

      const res = await proxy.app.inject({
        method: 'POST',
        url: '/membership/checkout',
        headers: {
          'x-test-reader': 'reader',
          'content-type': 'application/json',
        },
        payload: { plan: 'yearly' },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({
        error: { code: 'MEMBERSHIP_PROVIDER_NOT_CONFIGURED' },
      })
    })
  })

  describe('GET /membership/plans', () => {
    it('returns availability with pricing, without auth, when configured', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: '/membership/plans',
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        data: {
          enabled: true,
          plans: [
            {
              plan: 'monthly',
              pricing: {
                amount: 500,
                currency: 'USD',
                interval: 'month',
                interval_count: 1,
              },
            },
            {
              plan: 'yearly',
              pricing: {
                amount: 5000,
                currency: 'USD',
                interval: 'year',
                interval_count: 1,
              },
            },
          ],
        },
      })
    })

    it('omits pricing for a plan when the provider lookup fails', async () => {
      getPlanPricingMock.mockResolvedValueOnce(null as any)

      const res = await proxy.app.inject({
        method: 'GET',
        url: '/membership/plans',
      })

      expect(res.statusCode).toBe(200)
      const plans = res.json().data.plans
      expect(plans[0]).toEqual({ plan: 'monthly' })
      expect(plans[1].pricing).toBeDefined()
    })

    it('reports disabled with empty plans when membership is off', async () => {
      membershipConfig.enabled = false

      const res = await proxy.app.inject({
        method: 'GET',
        url: '/membership/plans',
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ data: { enabled: false, plans: [] } })
    })
  })

  describe('GET /membership/status', () => {
    it('returns a none shape when the reader has no membership', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: '/membership/status',
        headers: { 'x-test-reader': 'reader' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ data: { status: 'none' } })
    })

    it('rejects anonymous callers with 401', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: '/membership/status',
      })

      expect(res.statusCode).toBe(401)
    })

    it('reports expired for a stored-active membership past its currentPeriodEnd', async () => {
      const membershipRepository = proxy.app.get(MembershipRepository)
      await membershipRepository.create({
        readerId: expiredReaderId,
        provider: 'dodo',
        providerCustomerId: 'cus_expired',
        providerSubscriptionId: 'sub_expired',
        plan: 'monthly',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })

      const res = await proxy.app.inject({
        method: 'GET',
        url: '/membership/status',
        headers: { 'x-test-reader': 'expired-reader' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({
        data: { status: 'expired', plan: 'monthly', provider: 'dodo' },
      })
    })
  })

  describe('POST /membership/webhook/:provider', () => {
    it('applies a valid event and is idempotent on double delivery', async () => {
      const payload = {
        eventId: 'evt_checkout_1',
        type: 'activated',
        customerId: 'cus_1',
        subscriptionId: 'sub_1',
        plan: 'monthly',
        currentPeriodEnd: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        readerId,
      }

      const first = await proxy.app.inject({
        method: 'POST',
        url: '/membership/webhook/dodo',
        headers: { 'x-signature': 'valid', 'content-type': 'application/json' },
        payload,
      })
      expect(first.statusCode).toBe(201)
      expect(first.json()).toMatchObject({ data: { ok: true, applied: true } })

      const second = await proxy.app.inject({
        method: 'POST',
        url: '/membership/webhook/dodo',
        headers: { 'x-signature': 'valid', 'content-type': 'application/json' },
        payload,
      })
      expect(second.statusCode).toBe(201)
      expect(second.json()).toMatchObject({
        data: { ok: true, applied: false },
      })

      const status = await proxy.app.inject({
        method: 'GET',
        url: '/membership/status',
        headers: { 'x-test-reader': 'reader' },
      })
      expect(status.json()).toMatchObject({
        data: { status: 'active', plan: 'monthly', provider: 'dodo' },
      })
    })

    it('returns 400 on signature verification failure', async () => {
      const res = await proxy.app.inject({
        method: 'POST',
        url: '/membership/webhook/dodo',
        headers: {
          'x-signature': 'invalid',
          'content-type': 'application/json',
        },
        payload: { eventId: 'evt_bad' },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({
        error: { code: 'WEBHOOK_VERIFY_FAILED' },
      })
    })

    it('returns 400 for an unknown provider param', async () => {
      const res = await proxy.app.inject({
        method: 'POST',
        url: '/membership/webhook/unknown-provider',
        headers: { 'content-type': 'application/json' },
        payload: {},
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({
        error: { code: 'WEBHOOK_VERIFY_FAILED' },
      })
      expect(verifyAndParseWebhookMock).not.toHaveBeenCalled()
    })
  })

  describe('GET /membership/members', () => {
    it('rejects callers without the owner test-token header', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: '/membership/members',
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns a paginated member list for the owner', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: '/membership/members',
        headers: { 'test-token': '1' },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.meta.pagination).toMatchObject({ page: 1, size: 20 })
      expect(body.data.some((row: any) => row.reader.id === readerId)).toBe(
        true,
      )
    })
  })

  describe('PUT /membership/members/:readerId', () => {
    beforeAll(async () => {
      const membershipRepository = proxy.app.get(MembershipRepository)
      await membershipRepository.create({
        readerId: liveSubReaderId,
        provider: 'dodo',
        providerCustomerId: 'cus_live',
        providerSubscriptionId: 'sub_live',
        plan: 'monthly',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
    })

    it('grants a manual membership', async () => {
      const expiresAt = new Date(
        Date.now() + 60 * 24 * 60 * 60 * 1000,
      ).toISOString()

      const res = await proxy.app.inject({
        method: 'PUT',
        url: `/membership/members/${otherReaderId}`,
        headers: { 'test-token': '1', 'content-type': 'application/json' },
        payload: { plan: 'yearly', expiresAt },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({
        data: { status: 'active', plan: 'yearly', provider: 'manual' },
      })
    })

    it('rejects grant when the reader has a live provider-managed subscription', async () => {
      const res = await proxy.app.inject({
        method: 'PUT',
        url: `/membership/members/${liveSubReaderId}`,
        headers: { 'test-token': '1', 'content-type': 'application/json' },
        payload: {
          plan: 'monthly',
          expiresAt: new Date(Date.now() + 1000 * 60).toISOString(),
        },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({
        error: { code: 'INVALID_PARAMETER' },
      })
    })

    it('returns 422 for a malformed readerId path param', async () => {
      const res = await proxy.app.inject({
        method: 'PUT',
        url: '/membership/members/not-a-valid-id',
        headers: { 'test-token': '1', 'content-type': 'application/json' },
        payload: {
          plan: 'monthly',
          expiresAt: new Date(Date.now() + 1000 * 60).toISOString(),
        },
      })

      expect(res.statusCode).toBe(422)
    })

    it('rejects manual grant/revoke callers without the owner test-token header', async () => {
      const res = await proxy.app.inject({
        method: 'PUT',
        url: `/membership/members/${otherReaderId}`,
        headers: { 'content-type': 'application/json' },
        payload: { plan: 'monthly', expiresAt: new Date().toISOString() },
      })

      expect(res.statusCode).toBe(401)
    })
  })

  describe('DELETE /membership/members/:readerId', () => {
    it('revokes a manual grant', async () => {
      const res = await proxy.app.inject({
        method: 'DELETE',
        url: `/membership/members/${otherReaderId}`,
        headers: { 'test-token': '1' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({
        data: { status: 'cancelled', provider: 'manual' },
      })
    })

    it('returns 422 for a malformed readerId path param', async () => {
      const res = await proxy.app.inject({
        method: 'DELETE',
        url: '/membership/members/not-a-valid-id',
        headers: { 'test-token': '1' },
      })

      expect(res.statusCode).toBe(422)
    })
  })
})
