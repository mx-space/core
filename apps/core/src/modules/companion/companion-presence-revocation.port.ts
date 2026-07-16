export const COMPANION_PRESENCE_REVOCATION_PORT = Symbol(
  'CompanionPresenceRevocationPort',
)

export interface CompanionPresenceRevocationPort {
  removeDevice: (deviceId: string) => Promise<void>
}
