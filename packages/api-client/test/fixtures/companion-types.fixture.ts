import type {
  CompanionPresenceClearRequestV2,
  CompanionPresenceRequestV2,
} from '../../dtos/companion'
import type {
  CompanionCapabilities,
  CompanionPresenceChangedPayload,
  CompanionPresenceMutationResultV2,
  PublicLiveDeskStateV2,
} from '../../models/companion'

const state: PublicLiveDeskStateV2 = {
  schemaVersion: 2,
  epoch: 'epoch-1',
  revision: 1,
  projection: {
    availability: 'active',
    updatedAt: '2026-07-16T12:00:00.000Z',
    expiresAt: '2026-07-16T12:01:30.000Z',
    application: {
      displayName: 'Xcode',
      activity: { key: 'editing', customLabel: null },
      window: null,
      icon: null,
    },
    media: null,
  },
}

const snapshot: CompanionPresenceRequestV2 = {
  meta: {
    schema: 'yohaku.companion.presence',
    schemaVersion: 2,
    requestId: 'request-1',
    deviceId: 'device-1',
    sequence: 1,
    observedAt: '2026-07-16T12:00:00.000Z',
  },
  data: {
    availability: 'active',
    lease: { ttlSeconds: 90 },
    application: state.projection?.application ?? null,
    media: {
      sessionId: 'session-1',
      kind: 'music',
      title: 'Track',
      artist: null,
      album: null,
      player: null,
      playback: {
        state: 'paused',
        durationMs: null,
        positionMs: 0,
        sampledAt: '2026-07-16T12:00:00.000Z',
        rate: 0,
      },
    },
  },
}

const clear: CompanionPresenceClearRequestV2 = {
  meta: {
    ...snapshot.meta,
    requestId: 'request-2',
    sequence: 2,
  },
  data: { reason: 'privacyChanged' },
}

const mutation: CompanionPresenceMutationResultV2 = {
  acceptedSequence: 1,
  receivedAt: '2026-07-16T12:00:00.100Z',
  state,
}

const eventPayload: CompanionPresenceChangedPayload = state

const capabilities: CompanionCapabilities = {
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
}

export const __companionConsumerSmoke = {
  capabilities,
  clear,
  eventPayload,
  mutation,
  snapshot,
  state,
}
