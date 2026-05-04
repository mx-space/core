import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { WebhookController } from '~/modules/webhook/webhook.controller'
import { WebhookService } from '~/modules/webhook/webhook.service'

import { assertNoLegacyKeys } from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import { authPassHeader } from '../../mock/guard/auth.guard'

const fixtureWebhook = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000001000',
  payloadUrl: 'https://example.com/hook',
  events: ['all'],
  enabled: true,
  scope: 1,
  // legacy column name from the migration; explicitly NOT created/modified.
  timestamp: new Date('2024-11-01T00:00:00.000Z'),
  ...overrides,
})

const webhookServiceProvider = {
  provide: WebhookService,
  useValue: {
    async getAllWebhooks() {
      return [fixtureWebhook()]
    },
    transformEvents(events: string[]) {
      return events
    },
  },
}

describe('WebhookController contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [WebhookController],
    providers: [webhookServiceProvider],
  })

  test('GET /webhooks — admin list, no legacy keys, no leaked secret', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/webhooks`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    // Webhook rows must never expose the signing secret on listing.
    for (const row of body.data) {
      expect(row.secret).toBeUndefined()
    }
  })
})
