import { createE2EApp } from 'test/helper/create-e2e-app'

import { CompanionController } from '~/modules/companion/companion.controller'
import {
  COMPANION_CAPABILITIES,
  CompanionCapabilitiesResponseV2Schema,
} from '~/modules/companion/companion.schema'

describe('Companion capabilities', () => {
  const proxy = createE2EApp({ controllers: [CompanionController] })

  it('returns a strict camelCase envelope with the configured capabilities', async () => {
    const response = await proxy.app.inject({
      method: 'GET',
      url: '/companion/capabilities',
    })

    expect(response.statusCode).toBe(200)

    const body = CompanionCapabilitiesResponseV2Schema.parse(response.json())
    expect(body.data.presenceSchemaVersions).toContain(2)
    expect(body.data.features).toEqual(COMPANION_CAPABILITIES.features)
    expect(body.data.features.mediaTimeline).toBe(true)
    expect(body.data.features.mediaArtwork).toBe(true)
    expect(body.data.features.mediaPlaybackLinks).toBe(true)
    expect(body.data.limits.recommendedHeartbeatSeconds).toBeGreaterThanOrEqual(
      body.data.limits.presenceLeaseMinSeconds,
    )
    expect(body.data.limits.recommendedHeartbeatSeconds).toBeLessThanOrEqual(
      body.data.limits.presenceLeaseMaxSeconds,
    )

    const rawBody = response.json()
    expect(rawBody.data).toHaveProperty('minimumClientVersion')
    expect(rawBody.data).not.toHaveProperty('minimum_client_version')
    expect(rawBody.meta).toHaveProperty('requestId')
    expect(rawBody.meta).not.toHaveProperty('request_id')
  })
})
