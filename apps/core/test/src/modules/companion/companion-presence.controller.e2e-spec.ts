import { Body, Controller, Post } from '@nestjs/common'
import { createE2EApp } from 'test/helper/create-e2e-app'
import { vi } from 'vitest'

import { COMPANION_CLIENT_VERSION_HEADER } from '~/modules/companion/companion.constants'
import {
  CompanionFailureResponseV2Schema,
  CompanionPresenceMutationResponseV2Schema,
  CompanionPublicPresenceResponseV2Schema,
} from '~/modules/companion/companion.schema'
import { CompanionCredentialService } from '~/modules/companion/companion-credential.service'
import { CompanionDeviceGuard } from '~/modules/companion/companion-device.guard'
import { CompanionDeviceRepository } from '~/modules/companion/companion-device.repository'
import { CompanionPresenceController } from '~/modules/companion/companion-presence.controller'
import {
  CompanionPresenceStore,
  CompanionSequenceError,
} from '~/modules/companion/companion-presence.store'
import {
  CompanionPresenceRateLimiter,
  CompanionPresenceTransportGuard,
} from '~/modules/companion/companion-presence.transport'

const DEVICE_ID = '01K0A4VDWYSH1JQH4PGY4QM8YT'
const REQUEST_ID = '01K0A5Q2R7Y5VXG4H7Q0F4M9J2'
const EPOCH = '01K0A5P1KD0QAFMZKVFNFC7AFN'

const state = {
  schemaVersion: 2 as const,
  epoch: EPOCH,
  revision: 4,
  projection: null,
}

const mutationResult = {
  acceptedSequence: 0,
  receivedAt: '2026-07-16T12:00:00.180Z',
  state,
}

const store = {
  putSnapshot: vi.fn().mockResolvedValue(mutationResult),
  clear: vi.fn().mockResolvedValue(mutationResult),
  getPublicState: vi.fn().mockResolvedValue(state),
}
const rateLimiter = { consume: vi.fn().mockResolvedValue(undefined) }
const deviceRepository = {
  findDeviceById: vi.fn().mockResolvedValue({
    id: DEVICE_ID,
    ownerId: 'owner',
    scopes: ['companion:presence:write'],
    tokenHash: 'hash',
    revokedAt: null,
  }),
  markLastSeen: vi.fn().mockResolvedValue(undefined),
}
const credentialService = {
  deviceIdFromToken: vi.fn().mockReturnValue(DEVICE_ID),
  verifyDeviceToken: vi.fn().mockReturnValue(true),
}

const makeRequest = (deviceId = DEVICE_ID) => ({
  meta: {
    schema: 'yohaku.companion.presence',
    schemaVersion: 2,
    requestId: REQUEST_ID,
    deviceId,
    sequence: 0,
    observedAt: '2026-07-16T12:00:00.000Z',
  },
  data: {
    availability: 'active',
    lease: { ttlSeconds: 90 },
    application: {
      displayName: 'Xcode',
      activity: { key: 'editing', customLabel: null },
      window: null,
      icon: null,
    },
    media: null,
  },
})

@Controller()
class UnrelatedJsonController {
  @Post('/unrelated-json')
  accept(@Body() body: unknown) {
    return body
  }
}

describe('Companion presence protocol endpoints', () => {
  const proxy = createE2EApp({
    controllers: [CompanionPresenceController, UnrelatedJsonController],
    providers: [
      { provide: CompanionPresenceStore, useValue: store },
      { provide: CompanionPresenceRateLimiter, useValue: rateLimiter },
      CompanionPresenceTransportGuard,
      CompanionDeviceGuard,
      { provide: CompanionDeviceRepository, useValue: deviceRepository },
      { provide: CompanionCredentialService, useValue: credentialService },
    ],
  })

  beforeEach(() => {
    vi.clearAllMocks()
    store.putSnapshot.mockResolvedValue(mutationResult)
  })

  it('correlates an authenticated snapshot response without recasing protocol keys', async () => {
    const response = await proxy.app.inject({
      method: 'PUT',
      url: '/companion/presence',
      headers: {
        authorization: 'Bearer device-token',
        [COMPANION_CLIENT_VERSION_HEADER]: '1.7.3',
      },
      payload: makeRequest(),
    })

    expect(response.statusCode).toBe(200)
    const body = CompanionPresenceMutationResponseV2Schema.parse(
      response.json(),
    )
    expect(body.meta.requestId).toBe(REQUEST_ID)
    expect(body.data).toEqual(mutationResult)
    expect(store.putSnapshot).toHaveBeenCalledTimes(1)
    expect(rateLimiter.consume).toHaveBeenCalledWith(DEVICE_ID)
  })

  it('rejects mutation without a device token using the protocol error envelope', async () => {
    const response = await proxy.app.inject({
      method: 'PUT',
      url: '/companion/presence',
      headers: { [COMPANION_CLIENT_VERSION_HEADER]: '1.7.3' },
      payload: makeRequest(),
    })

    expect(response.statusCode).toBe(401)
    expect(
      CompanionFailureResponseV2Schema.parse(response.json()),
    ).toMatchObject({
      meta: { requestId: REQUEST_ID },
      error: {
        code: 'COMPANION_DEVICE_REVOKED',
        retryable: false,
      },
    })
  })

  it('rejects the wrong media type before DTO validation', async () => {
    const response = await proxy.app.inject({
      method: 'PUT',
      url: '/companion/presence',
      headers: {
        authorization: 'Bearer device-token',
        'content-type': 'application/xml',
      },
      payload: JSON.stringify(makeRequest()),
    })

    expect(response.statusCode).toBe(415)
    expect(
      CompanionFailureResponseV2Schema.parse(response.json()),
    ).toMatchObject({
      error: { code: 'COMPANION_MEDIA_TYPE_UNSUPPORTED' },
    })
    expect(store.putSnapshot).not.toHaveBeenCalled()
  })

  it('maps an empty JSON body at the Companion route boundary', async () => {
    const response = await proxy.app.inject({
      method: 'PUT',
      url: '/companion/presence',
      headers: {
        authorization: 'Bearer device-token',
        'content-type': 'application/json',
        [COMPANION_CLIENT_VERSION_HEADER]: '1.7.3',
      },
      payload: '',
    })

    expect(response.statusCode).toBe(400)
    expect(
      CompanionFailureResponseV2Schema.parse(response.json()),
    ).toMatchObject({
      error: {
        code: 'COMPANION_PAYLOAD_INVALID',
        retryable: false,
      },
    })
    expect(store.putSnapshot).not.toHaveBeenCalled()
  })

  it('returns the protocol envelope when JSON parsing fails before the controller', async () => {
    const response = await proxy.app.inject({
      method: 'PUT',
      url: '/companion/presence',
      headers: {
        authorization: 'Bearer device-token',
        'content-type': 'application/json',
        [COMPANION_CLIENT_VERSION_HEADER]: '1.7.3',
      },
      payload: '{bad',
    })

    expect(response.statusCode).toBe(400)
    expect(
      CompanionFailureResponseV2Schema.parse(response.json()),
    ).toMatchObject({
      meta: {
        schema: 'yohaku.companion.presence',
        schemaVersion: 2,
      },
      error: {
        code: 'COMPANION_PAYLOAD_INVALID',
        retryable: false,
        retryAfterMs: null,
        acceptedSequence: null,
        fields: [],
      },
    })
    expect(store.putSnapshot).not.toHaveBeenCalled()
  })

  it('applies the same early JSON boundary to clear mutations', async () => {
    const response = await proxy.app.inject({
      method: 'POST',
      url: '/companion/presence/clear',
      headers: {
        authorization: 'Bearer device-token',
        'content-type': 'application/json',
        [COMPANION_CLIENT_VERSION_HEADER]: '1.7.3',
      },
      payload: '{bad',
    })

    expect(response.statusCode).toBe(400)
    expect(
      CompanionFailureResponseV2Schema.parse(response.json()),
    ).toMatchObject({
      error: {
        code: 'COMPANION_PAYLOAD_INVALID',
        retryable: false,
      },
    })
    expect(store.clear).not.toHaveBeenCalled()
  })

  it('leaves malformed JSON on unrelated routes to the global error contract', async () => {
    const response = await proxy.app.inject({
      method: 'POST',
      url: '/unrelated-json',
      headers: { 'content-type': 'application/json' },
      payload: '{bad',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      error: { code: 'HTTP_ERROR' },
    })
  })

  it('enforces the route raw-body limit before accepting a snapshot', async () => {
    const oversized = makeRequest() as any
    oversized.data.application.window = { title: 'x'.repeat(33_000) }

    const response = await proxy.app.inject({
      method: 'PUT',
      url: '/companion/presence',
      headers: { authorization: 'Bearer device-token' },
      payload: oversized,
    })

    expect(response.statusCode).toBe(413)
    expect(
      CompanionFailureResponseV2Schema.parse(response.json()),
    ).toMatchObject({
      error: { code: 'COMPANION_PAYLOAD_TOO_LARGE' },
    })
    expect(store.putSnapshot).not.toHaveBeenCalled()
  })

  it('returns the negotiated schema boundary before consuming a mutation', async () => {
    const request = makeRequest() as any
    request.meta.schemaVersion = 3

    const response = await proxy.app.inject({
      method: 'PUT',
      url: '/companion/presence',
      headers: { authorization: 'Bearer device-token' },
      payload: request,
    })

    expect(response.statusCode).toBe(426)
    expect(
      CompanionFailureResponseV2Schema.parse(response.json()),
    ).toMatchObject({
      meta: { requestId: REQUEST_ID },
      error: {
        code: 'COMPANION_SCHEMA_UNSUPPORTED',
        retryable: false,
      },
    })
    expect(rateLimiter.consume).not.toHaveBeenCalled()
    expect(store.putSnapshot).not.toHaveBeenCalled()
  })

  it('returns a canonical public baseline with a server request ID', async () => {
    const response = await proxy.app.inject({
      method: 'GET',
      url: '/companion/presence/public',
    })

    expect(response.statusCode).toBe(200)
    const body = CompanionPublicPresenceResponseV2Schema.parse(response.json())
    expect(body.data.state).toEqual(state)
    expect(body.meta.requestId).toMatch(/^[\da-f-]{36}$/)
  })

  it('collapses a token-to-device mismatch into the revoked-device boundary', async () => {
    const response = await proxy.app.inject({
      method: 'PUT',
      url: '/companion/presence',
      headers: {
        authorization: 'Bearer device-token',
        [COMPANION_CLIENT_VERSION_HEADER]: '1.7.3',
      },
      payload: makeRequest('019c7aa4-a124-719d-970f-a4bb8b12d92d'),
    })

    expect(response.statusCode).toBe(401)
    expect(
      CompanionFailureResponseV2Schema.parse(response.json()),
    ).toMatchObject({
      meta: { requestId: REQUEST_ID },
      error: {
        code: 'COMPANION_DEVICE_REVOKED',
        retryable: false,
        acceptedSequence: null,
        fields: [],
      },
    })
    expect(store.putSnapshot).not.toHaveBeenCalled()
  })

  it('maps a sequence conflict to the v2 error envelope', async () => {
    store.putSnapshot.mockRejectedValueOnce(
      new CompanionSequenceError('COMPANION_SEQUENCE_CONFLICT', 7),
    )

    const response = await proxy.app.inject({
      method: 'PUT',
      url: '/companion/presence',
      headers: {
        authorization: 'Bearer device-token',
        [COMPANION_CLIENT_VERSION_HEADER]: '1.7.3',
      },
      payload: makeRequest(),
    })

    expect(response.statusCode).toBe(409)
    expect(
      CompanionFailureResponseV2Schema.parse(response.json()),
    ).toMatchObject({
      meta: { requestId: REQUEST_ID },
      error: {
        code: 'COMPANION_SEQUENCE_CONFLICT',
        acceptedSequence: 7,
        retryable: false,
        fields: [],
      },
    })
  })
})
