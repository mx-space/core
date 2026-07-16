export const COMPANION_PRESENCE_SCHEMA = 'yohaku.companion.presence'
export const COMPANION_PRESENCE_SCHEMA_VERSION = 2 as const
export const COMPANION_CLIENT_VERSION_HEADER =
  'x-yohaku-companion-version' as const

const readBooleanEnvironmentFlag = (
  value: string | undefined,
  defaultValue: boolean,
) => {
  const normalizedValue = value?.trim().toLowerCase()
  return normalizedValue ? normalizedValue === 'true' : defaultValue
}

// Presence v2 already transports timeline anchors. Keep this available for
// existing local integrations while allowing staged deployments to suppress
// the capability explicitly.
export const COMPANION_MEDIA_TIMELINE_ENABLED = readBooleanEnvironmentFlag(
  process.env.COMPANION_MEDIA_TIMELINE_ENABLED,
  true,
)

// This is the first Yohaku Companion release containing the Companion v2
// transport. Keep the capability disabled until the authenticated mutation
// path is deployed.
export const COMPANION_MINIMUM_CLIENT_VERSION = '1.7.3'

export const COMPANION_PRESENCE_PAYLOAD_BYTES = 32 * 1024
export const COMPANION_PRESENCE_REQUESTS_PER_MINUTE = 30
export const COMPANION_PRESENCE_LEASE_MIN_SECONDS = 30
export const COMPANION_PRESENCE_LEASE_MAX_SECONDS = 120
export const COMPANION_RECOMMENDED_HEARTBEAT_SECONDS = 30
export const COMPANION_MAXIMUM_CLOCK_SKEW_SECONDS = 30

export const COMPANION_APPLICATION_DISPLAY_NAME_MAX_SCALARS = 120
export const COMPANION_WINDOW_TITLE_MAX_SCALARS = 500
export const COMPANION_ACTIVITY_CUSTOM_LABEL_MAX_SCALARS = 80
export const COMPANION_MEDIA_TEXT_MAX_SCALARS = 300
export const COMPANION_PLAYER_DISPLAY_NAME_MAX_SCALARS = 120
export const COMPANION_ICON_URL_MAX_BYTES = 2048
export const COMPANION_MEDIA_POSITION_TOLERANCE_MS = 2000
