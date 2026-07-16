export type CompanionPresenceSchema = 'yohaku.companion.presence'

export type LiveDeskAvailability = 'idle' | 'active'

export type MediaKind = 'music' | 'podcast' | 'video' | 'unknown'

export type MediaPlaybackState = 'playing' | 'paused'

export interface CompanionApplicationContext {
  displayName: string
  activity: {
    key: string | null
    customLabel: string | null
  } | null
  window: { title: string } | null
  icon: { url: string } | null
}

export interface CompanionMediaContext {
  sessionId: string
  kind: MediaKind
  title: string | null
  artist: string | null
  album: string | null
  player: { displayName: string } | null
  playback: {
    state: MediaPlaybackState
    durationMs: number | null
    positionMs: number | null
    sampledAt: string
    rate: number
  }
}

export interface PublicMediaPresenceV2 {
  sessionId: string
  kind: MediaKind
  title: string | null
  artist: string | null
  album: string | null
  player: { displayName: string } | null
  playback: {
    state: MediaPlaybackState
    durationMs: number | null
    positionMs: number | null
    anchorAt: string
    rate: number
  }
}

export type PublicApplicationPresenceV2 = CompanionApplicationContext

export interface PublicLiveDeskProjectionV2 {
  availability: LiveDeskAvailability
  updatedAt: string
  expiresAt: string
  application: PublicApplicationPresenceV2 | null
  media: PublicMediaPresenceV2 | null
}

export interface PublicLiveDeskStateV2 {
  schemaVersion: 2
  epoch: string
  revision: number
  projection: PublicLiveDeskProjectionV2 | null
}

export interface CompanionCapabilities {
  minimumClientVersion: string
  presenceSchemaVersions: number[]
  momentSchemaVersions: number[]
  features: {
    liveDesk: boolean
    mediaTimeline: boolean
    moments: boolean
    readingSessions: boolean
  }
  limits: {
    presencePayloadBytes: number
    presenceRequestsPerMinute: number
    presenceLeaseMinSeconds: number
    presenceLeaseMaxSeconds: number
    recommendedHeartbeatSeconds: number
    maximumClockSkewSeconds: number
  }
}

export interface CompanionResponseMetaV2 {
  schema: CompanionPresenceSchema
  schemaVersion: 2
  requestId: string
  serverTime: string
}

export interface CompanionPresenceMutationResultV2 {
  acceptedSequence: number
  receivedAt: string
  state: PublicLiveDeskStateV2
}

export interface CompanionPublicPresenceResultV2 {
  state: PublicLiveDeskStateV2
}

/** Payload carried by the `companion.presence.changed` gateway event. */
export type CompanionPresenceChangedPayload = PublicLiveDeskStateV2

export type CompanionDeviceScope =
  | 'companion:presence:write'
  | 'companion:moment:write'
  | 'companion:reading:read'
  | 'companion:reading:write'

export interface CompanionPairingResult {
  pairingId: string
  pairingCode: string
  expiresAt: string
}

export interface CompanionPairingClaimResult {
  deviceId: string
  deviceToken: string
  scopes: CompanionDeviceScope[]
  nextSequence: number
}

export interface CompanionDevice {
  id: string
  name: string
  scopes: CompanionDeviceScope[]
  createdAt: string
  lastSeenAt: string | null
  revokedAt: string | null
}

export interface CompanionDeviceRevocationResult {
  deviceId: string
  revokedAt: string
}

export interface CompanionErrorV2 {
  code: string
  message: string
  retryable: boolean
  retryAfterMs: number | null
  acceptedSequence: number | null
  fields: string[]
}

export interface CompanionFailureResponseV2 {
  meta: CompanionResponseMetaV2
  error: CompanionErrorV2
}
