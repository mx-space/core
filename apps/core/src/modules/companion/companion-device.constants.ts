import type { CompanionDeviceScope } from '~/database/schema'

export const COMPANION_PAIRING_TTL_MS = 10 * 60 * 1000
export const COMPANION_DEVICE_LAST_SEEN_WRITE_INTERVAL_MS = 60 * 1000

export const COMPANION_DEVICE_SCOPES = [
  'companion:presence:write',
  'companion:moment:write',
  'companion:reading:read',
  'companion:reading:write',
] as const satisfies readonly CompanionDeviceScope[]

export const DEFAULT_COMPANION_DEVICE_SCOPES = [
  'companion:presence:write',
] as const satisfies readonly CompanionDeviceScope[]

export const CompanionDeviceErrorCode = {
  pairingExpired: 'COMPANION_PAIRING_EXPIRED',
  deviceRevoked: 'COMPANION_DEVICE_REVOKED',
  scopeDenied: 'COMPANION_SCOPE_DENIED',
  deviceNotFound: 'COMPANION_DEVICE_NOT_FOUND',
} as const
