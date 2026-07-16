import type {
  CompanionApplicationContext,
  CompanionDeviceScope,
  CompanionMediaContext,
  CompanionPresenceSchema,
  LiveDeskAvailability,
} from '../models/companion'

export const COMPANION_CLIENT_VERSION_HEADER =
  'X-Yohaku-Companion-Version' as const

export interface CompanionRequestMetaV2 {
  schema: CompanionPresenceSchema
  schemaVersion: 2
  requestId: string
  deviceId: string
  observedAt: string
}

export interface OrderedCompanionRequestMetaV2 extends CompanionRequestMetaV2 {
  sequence: number
}

export interface CompanionRequestV2<TData> {
  meta: CompanionRequestMetaV2
  data: TData
}

export interface OrderedCompanionRequestV2<TData> {
  meta: OrderedCompanionRequestMetaV2
  data: TData
}

export interface CompanionPresenceDataV2 {
  availability: LiveDeskAvailability
  lease: { ttlSeconds: number }
  application: CompanionApplicationContext | null
  media: CompanionMediaContext | null
}

export type CompanionPresenceRequestV2 =
  OrderedCompanionRequestV2<CompanionPresenceDataV2>

export type CompanionPresenceClearReason =
  'paused' | 'sleep' | 'shutdown' | 'privacyChanged' | 'connectionRemoved'

export interface CompanionPresenceClearDataV2 {
  reason: CompanionPresenceClearReason
}

export type CompanionPresenceClearRequestV2 =
  OrderedCompanionRequestV2<CompanionPresenceClearDataV2>

export interface CreateCompanionPairingInput {
  scopes?: CompanionDeviceScope[]
}

export interface ClaimCompanionPairingInput {
  pairingCode: string
  deviceName: string
}
