import { deleteJson, getJson, postJson } from './http'

export type CompanionDeviceScope =
  | 'companion:presence:write'
  | 'companion:moment:write'
  | 'companion:reading:read'
  | 'companion:reading:write'

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

export interface CompanionPairingResult {
  pairingId: string
  pairingCode: string
  expiresAt: string
}

export interface CompanionDevice {
  id: string
  name: string
  scopes: CompanionDeviceScope[]
  createdAt: string
  lastSeenAt: null | string
  revokedAt: null | string
}

export interface CompanionDeviceRevocationResult {
  deviceId: string
  revokedAt: string
}

export type CompanionLiveDeskAvailability = 'idle' | 'active'

export interface CompanionPublicApplicationPresence {
  displayName: string
  activity: {
    key: null | string
    customLabel: null | string
  } | null
  window: { title: string } | null
  icon: { url: string } | null
}

export interface CompanionPublicMediaPresence {
  sessionId: string
  kind: 'music' | 'podcast' | 'unknown' | 'video'
  title: null | string
  artist: null | string
  album: null | string
  player: { displayName: string } | null
  playback: {
    state: 'paused' | 'playing'
    durationMs: null | number
    positionMs: null | number
    anchorAt: string
    rate: number
  }
}

export interface CompanionPublicLiveDeskProjection {
  availability: CompanionLiveDeskAvailability
  updatedAt: string
  expiresAt: string
  application: CompanionPublicApplicationPresence | null
  media: CompanionPublicMediaPresence | null
}

export interface CompanionPublicPresenceResult {
  state: {
    schemaVersion: 2
    epoch: string
    revision: number
    projection: CompanionPublicLiveDeskProjection | null
  }
}

const LIVE_DESK_SCOPES = [
  'companion:presence:write',
] as const satisfies readonly CompanionDeviceScope[]

export function getCompanionCapabilities() {
  return getJson<CompanionCapabilities>('/companion/capabilities')
}

export function getCompanionDevices() {
  return getJson<CompanionDevice[]>('/companion/devices')
}

export function getCompanionPublicPresence() {
  return getJson<CompanionPublicPresenceResult>('/companion/presence/public')
}

export function createCompanionPairing() {
  return postJson<CompanionPairingResult, { scopes: CompanionDeviceScope[] }>(
    '/companion/pairings',
    { scopes: [...LIVE_DESK_SCOPES] },
  )
}

export function revokeCompanionDevice(deviceId: string) {
  return deleteJson<CompanionDeviceRevocationResult>(
    `/companion/devices/${encodeURIComponent(deviceId)}`,
  )
}
