import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { axiosAdaptor } from '~/adaptors/axios'
import { CompanionController } from '~/controllers'
import type {
  CompanionPresenceClearRequestV2,
  CompanionPresenceRequestV2,
} from '~/dtos/companion'
import { COMPANION_CLIENT_VERSION_HEADER } from '~/dtos/companion'

describe('test Companion client', () => {
  const client = mockRequestInstance(CompanionController)

  const snapshotRequest: CompanionPresenceRequestV2 = {
    meta: {
      schema: 'yohaku.companion.presence',
      schemaVersion: 2,
      requestId: 'request-124',
      deviceId: 'device-1',
      sequence: 124,
      observedAt: '2026-07-16T12:00:00.000Z',
    },
    data: {
      availability: 'active',
      lease: { ttlSeconds: 90 },
      application: {
        displayName: 'Xcode',
        activity: {
          key: 'editing',
          customLabel: null,
        },
        window: null,
        icon: {
          url: 'https://assets.example.com/apps/xcode.png',
        },
      },
      media: {
        sessionId: 'media-session-1',
        kind: 'music',
        title: 'Track title',
        artist: 'Artist',
        album: null,
        player: { displayName: 'Music' },
        playback: {
          state: 'playing',
          durationMs: 203_000,
          positionMs: 72_400,
          sampledAt: '2026-07-16T11:59:59.600Z',
          rate: 1,
        },
      },
    },
  }

  test('GET /capabilities', async () => {
    mockResponse('/companion/capabilities', {
      minimumClientVersion: '1.0.0',
      presenceSchemaVersions: [2],
      momentSchemaVersions: [1],
      features: {
        liveDesk: true,
        mediaTimeline: true,
        moments: true,
        readingSessions: false,
      },
      limits: {
        presencePayloadBytes: 32_768,
        presenceRequestsPerMinute: 30,
        presenceLeaseMinSeconds: 30,
        presenceLeaseMaxSeconds: 120,
        recommendedHeartbeatSeconds: 30,
        maximumClockSkewSeconds: 30,
      },
    })

    await expect(client.companion.getCapabilities()).resolves.toMatchObject({
      minimumClientVersion: '1.0.0',
      presenceSchemaVersions: [2],
      momentSchemaVersions: [1],
      features: {
        liveDesk: true,
        mediaTimeline: true,
        moments: true,
        readingSessions: false,
      },
      limits: {
        presencePayloadBytes: 32_768,
        recommendedHeartbeatSeconds: 30,
      },
    })
  })

  test('PUT /presence sends the complete camelCase snapshot', async () => {
    mockResponse(
      '/companion/presence',
      {
        acceptedSequence: 124,
        receivedAt: '2026-07-16T12:00:00.180Z',
        state: {
          schemaVersion: 2,
          epoch: 'epoch-1',
          revision: 8451,
          projection: {
            availability: 'active',
            updatedAt: '2026-07-16T12:00:00.180Z',
            expiresAt: '2026-07-16T12:01:30.180Z',
            application: {
              displayName: 'Xcode',
              activity: {
                key: 'editing',
                customLabel: null,
              },
              window: null,
              icon: {
                url: 'https://assets.example.com/apps/xcode.png',
              },
            },
            media: {
              sessionId: 'media-session-1',
              kind: 'music',
              title: 'Track title',
              artist: 'Artist',
              album: null,
              player: { displayName: 'Music' },
              playback: {
                state: 'playing',
                durationMs: 203_000,
                positionMs: 72_980,
                anchorAt: '2026-07-16T12:00:00.180Z',
                rate: 1,
              },
            },
          },
        },
      },
      'put',
      snapshotRequest,
      {
        schema: 'yohaku.companion.presence',
        schemaVersion: 2,
        requestId: 'request-124',
        serverTime: '2026-07-16T12:00:00.180Z',
      },
    )

    const result = await client.companion.replacePresence(
      snapshotRequest,
      '1.7.3',
    )

    expect(result).toMatchObject({
      acceptedSequence: 124,
      receivedAt: '2026-07-16T12:00:00.180Z',
      state: {
        schemaVersion: 2,
        epoch: 'epoch-1',
        revision: 8451,
        projection: {
          application: {
            displayName: 'Xcode',
            activity: { key: 'editing', customLabel: null },
            window: null,
          },
          media: {
            sessionId: 'media-session-1',
            album: null,
            playback: {
              durationMs: 203_000,
              positionMs: 72_980,
              anchorAt: '2026-07-16T12:00:00.180Z',
            },
          },
        },
      },
    })
    expect(result.$meta).toMatchObject({
      schema: 'yohaku.companion.presence',
      schemaVersion: 2,
      requestId: 'request-124',
      serverTime: '2026-07-16T12:00:00.180Z',
    })
    expect(axiosAdaptor.put).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { [COMPANION_CLIENT_VERSION_HEADER]: '1.7.3' },
      }),
    )
  })

  test('POST /presence/clear preserves ordered clear data', async () => {
    const clearRequest: CompanionPresenceClearRequestV2 = {
      meta: {
        schema: 'yohaku.companion.presence',
        schemaVersion: 2,
        requestId: 'request-125',
        deviceId: 'device-1',
        sequence: 125,
        observedAt: '2026-07-16T12:00:03.000Z',
      },
      data: { reason: 'paused' },
    }

    mockResponse(
      '/companion/presence/clear',
      {
        acceptedSequence: 125,
        receivedAt: '2026-07-16T12:00:03.180Z',
        state: {
          schemaVersion: 2,
          epoch: 'epoch-1',
          revision: 8452,
          projection: null,
        },
      },
      'post',
      clearRequest,
    )

    await expect(
      client.companion.clearPresence(clearRequest, '1.7.3'),
    ).resolves.toMatchObject({
      acceptedSequence: 125,
      state: {
        schemaVersion: 2,
        revision: 8452,
        projection: null,
      },
    })
  })

  test('GET /presence/public returns an initialized empty state', async () => {
    mockResponse('/companion/presence/public', {
      state: {
        schemaVersion: 2,
        epoch: 'epoch-2',
        revision: 0,
        projection: null,
      },
    })

    await expect(client.companion.getPublicPresence()).resolves.toMatchObject({
      state: {
        schemaVersion: 2,
        epoch: 'epoch-2',
        revision: 0,
        projection: null,
      },
    })
  })

  test('supports owner pairing and device management routes', async () => {
    mockResponse(
      '/companion/pairings',
      {
        pairingId: 'pairing-1',
        pairingCode: 'ABCD-EFGH',
        expiresAt: '2026-07-16T12:10:00.000Z',
      },
      'post',
      { scopes: ['companion:presence:write'] },
    )
    await expect(
      client.companion.createPairing({
        scopes: ['companion:presence:write'],
      }),
    ).resolves.toMatchObject({
      pairingId: 'pairing-1',
      pairingCode: 'ABCD-EFGH',
    })

    mockResponse(
      '/companion/pairings/claim',
      {
        deviceId: 'device-1',
        deviceToken: 'secret-token',
        scopes: ['companion:presence:write'],
        nextSequence: 0,
      },
      'post',
      { pairingCode: 'ABCD-EFGH', deviceName: 'MacBook Pro' },
    )
    await expect(
      client.companion.claimPairing({
        pairingCode: 'ABCD-EFGH',
        deviceName: 'MacBook Pro',
      }),
    ).resolves.toMatchObject({
      deviceId: 'device-1',
      deviceToken: 'secret-token',
      nextSequence: 0,
    })

    mockResponse('/companion/devices', [
      {
        id: 'device-1',
        name: 'MacBook Pro',
        scopes: ['companion:presence:write'],
        createdAt: '2026-07-16T12:00:00.000Z',
        lastSeenAt: null,
        revokedAt: null,
      },
    ])
    await expect(client.companion.getDevices()).resolves.toMatchObject([
      { id: 'device-1', createdAt: '2026-07-16T12:00:00.000Z' },
    ])

    mockResponse(
      '/companion/devices/device-1',
      {
        deviceId: 'device-1',
        revokedAt: '2026-07-16T12:05:00.000Z',
      },
      'delete',
    )
    await expect(
      client.companion.revokeDevice('device-1'),
    ).resolves.toMatchObject({ deviceId: 'device-1' })
  })
})
