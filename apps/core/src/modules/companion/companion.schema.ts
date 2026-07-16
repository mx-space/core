import { Buffer } from 'node:buffer'

import { z } from 'zod'

import { isSemVer } from '~/utils/validator.util'

import {
  COMPANION_ACTIVITY_CUSTOM_LABEL_MAX_SCALARS,
  COMPANION_APPLICATION_DISPLAY_NAME_MAX_SCALARS,
  COMPANION_ICON_URL_MAX_BYTES,
  COMPANION_MAXIMUM_CLOCK_SKEW_SECONDS,
  COMPANION_MEDIA_POSITION_TOLERANCE_MS,
  COMPANION_MEDIA_TEXT_MAX_SCALARS,
  COMPANION_MEDIA_TIMELINE_ENABLED,
  COMPANION_MINIMUM_CLIENT_VERSION,
  COMPANION_PLAYER_DISPLAY_NAME_MAX_SCALARS,
  COMPANION_PRESENCE_LEASE_MAX_SECONDS,
  COMPANION_PRESENCE_LEASE_MIN_SECONDS,
  COMPANION_PRESENCE_PAYLOAD_BYTES,
  COMPANION_PRESENCE_REQUESTS_PER_MINUTE,
  COMPANION_PRESENCE_SCHEMA,
  COMPANION_PRESENCE_SCHEMA_VERSION,
  COMPANION_RECOMMENDED_HEARTBEAT_SECONDS,
  COMPANION_WINDOW_TITLE_MAX_SCALARS,
} from './companion.constants'

const ULID_PATTERN = /^[\dA-HJKMNP-TV-Z]{26}$/
const ACTIVITY_KEY_PATTERN = /^[a-z][\d.a-z-]{0,63}$/

const addCustomIssue = (
  context: z.RefinementCtx,
  path: PropertyKey[],
  message: string,
) => context.addIssue({ code: 'custom', message, path })

const normalizedUnicodeString = (label: string, maximumScalars: number) =>
  z
    .string()
    .refine((value) => value === value.trim(), `${label} must be trimmed.`)
    .refine((value) => value.length > 0, `${label} must not be empty.`)
    .refine(
      (value) => value === value.normalize('NFC'),
      `${label} must use Unicode NFC normalization.`,
    )
    .refine(
      (value) => Array.from(value).length <= maximumScalars,
      `${label} exceeds its Unicode scalar limit.`,
    )

const hasValidHttpsURL = (value: string) => {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

const validateAvailability = (
  value: {
    availability: 'idle' | 'active'
    application: unknown | null
    media: unknown | null
  },
  context: z.RefinementCtx,
) => {
  if (
    value.availability === 'active' &&
    value.application === null &&
    value.media === null
  ) {
    addCustomIssue(
      context,
      ['availability'],
      'Active presence requires an application or media context.',
    )
  }

  if (
    value.availability === 'idle' &&
    (value.application !== null || value.media !== null)
  ) {
    addCustomIssue(
      context,
      ['availability'],
      'Idle presence cannot contain application or media context.',
    )
  }
}

const validatePlayback = (
  value: {
    state: 'playing' | 'paused'
    durationMs: number | null
    positionMs: number | null
    rate: number
  },
  context: z.RefinementCtx,
  positionToleranceMs: number,
) => {
  if (value.state === 'paused' && value.rate !== 0) {
    addCustomIssue(context, ['rate'], 'Paused playback must have rate 0.')
  }
  if (value.state === 'playing' && value.rate <= 0) {
    addCustomIssue(
      context,
      ['rate'],
      'Playing playback must have a positive rate.',
    )
  }
  if (
    value.durationMs !== null &&
    value.positionMs !== null &&
    value.positionMs > value.durationMs + positionToleranceMs
  ) {
    addCustomIssue(
      context,
      ['positionMs'],
      'Playback position exceeds the permitted duration tolerance.',
    )
  }
}

const NonNegativeSafeIntegerSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER)

const PositiveSafeIntegerSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER)

const NullableNonNegativeSafeIntegerSchema =
  NonNegativeSafeIntegerSchema.nullable()

export const CompanionIdentifierSchema = z.union([
  z.uuid(),
  z.string().regex(ULID_PATTERN),
])

export const CompanionWireTimestampSchema = z.iso.datetime({ precision: 3 })

export const LiveDeskAvailabilityV2Schema = z.enum(['idle', 'active'])
export const CompanionMediaKindV2Schema = z.enum([
  'music',
  'podcast',
  'video',
  'unknown',
])
export const CompanionMediaPlaybackStateV2Schema = z.enum(['playing', 'paused'])

export const CompanionPresenceRequestMetaV2Schema = z
  .object({
    schema: z.literal(COMPANION_PRESENCE_SCHEMA),
    schemaVersion: z.literal(COMPANION_PRESENCE_SCHEMA_VERSION),
    requestId: CompanionIdentifierSchema,
    deviceId: CompanionIdentifierSchema,
    sequence: NonNegativeSafeIntegerSchema,
    observedAt: CompanionWireTimestampSchema,
  })
  .strict()

export const CompanionLeaseV2Schema = z
  .object({
    ttlSeconds: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER)
      .transform((value) =>
        Math.min(
          COMPANION_PRESENCE_LEASE_MAX_SECONDS,
          Math.max(COMPANION_PRESENCE_LEASE_MIN_SECONDS, value),
        ),
      ),
  })
  .strict()

export const CompanionActivityV2Schema = z
  .object({
    key: z.string().regex(ACTIVITY_KEY_PATTERN).nullable(),
    customLabel: normalizedUnicodeString(
      'Activity custom label',
      COMPANION_ACTIVITY_CUSTOM_LABEL_MAX_SCALARS,
    ).nullable(),
  })
  .strict()

export const CompanionWindowV2Schema = z
  .object({
    title: normalizedUnicodeString(
      'Window title',
      COMPANION_WINDOW_TITLE_MAX_SCALARS,
    ),
  })
  .strict()

// Asset-host allowlisting is a runtime policy concern and must be applied
// before persistence. This schema establishes the transport-level HTTPS and
// byte-length boundary without pretending that deployment configuration is
// available here.
export const CompanionIconV2Schema = z
  .object({
    url: z
      .string()
      .refine((value) => value === value.trim(), 'Icon URL must be trimmed.')
      .refine(
        (value) => value === value.normalize('NFC'),
        'Icon URL must use Unicode NFC normalization.',
      )
      .refine(hasValidHttpsURL, 'Icon URL must be an absolute HTTPS URL.')
      .refine(
        (value) =>
          Buffer.byteLength(value, 'utf8') <= COMPANION_ICON_URL_MAX_BYTES,
        'Icon URL exceeds its UTF-8 byte limit.',
      ),
  })
  .strict()

export const CompanionPlayerV2Schema = z
  .object({
    displayName: normalizedUnicodeString(
      'Player display name',
      COMPANION_PLAYER_DISPLAY_NAME_MAX_SCALARS,
    ),
  })
  .strict()

export const CompanionApplicationContextV2Schema = z
  .object({
    displayName: normalizedUnicodeString(
      'Application display name',
      COMPANION_APPLICATION_DISPLAY_NAME_MAX_SCALARS,
    ),
    activity: CompanionActivityV2Schema.nullable(),
    window: CompanionWindowV2Schema.nullable(),
    icon: CompanionIconV2Schema.nullable(),
  })
  .strict()

const CompanionMediaPlaybackInputV2Schema = z
  .object({
    state: CompanionMediaPlaybackStateV2Schema,
    durationMs: NullableNonNegativeSafeIntegerSchema,
    positionMs: NullableNonNegativeSafeIntegerSchema,
    sampledAt: CompanionWireTimestampSchema,
    rate: z.number().min(0).max(4),
  })
  .strict()
  .superRefine((value, context) =>
    validatePlayback(value, context, COMPANION_MEDIA_POSITION_TOLERANCE_MS),
  )

export const CompanionMediaPlaybackV2Schema =
  CompanionMediaPlaybackInputV2Schema.transform((value) => {
    if (
      value.durationMs !== null &&
      value.positionMs !== null &&
      value.positionMs > value.durationMs
    ) {
      return { ...value, positionMs: value.durationMs }
    }
    return value
  })

const NullableMediaTextSchema = normalizedUnicodeString(
  'Media text',
  COMPANION_MEDIA_TEXT_MAX_SCALARS,
).nullable()

export const CompanionMediaContextV2Schema = z
  .object({
    sessionId: CompanionIdentifierSchema,
    kind: CompanionMediaKindV2Schema,
    title: NullableMediaTextSchema,
    artist: NullableMediaTextSchema,
    album: NullableMediaTextSchema,
    player: CompanionPlayerV2Schema.nullable(),
    playback: CompanionMediaPlaybackV2Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.title === null && value.artist === null) {
      addCustomIssue(
        context,
        ['title'],
        'Media requires a title or artist; otherwise it must be null.',
      )
    }
  })

export const CompanionPresenceDataV2Schema = z
  .object({
    availability: LiveDeskAvailabilityV2Schema,
    lease: CompanionLeaseV2Schema,
    application: CompanionApplicationContextV2Schema.nullable(),
    media: CompanionMediaContextV2Schema.nullable(),
  })
  .strict()
  .superRefine(validateAvailability)

export const CompanionPresenceRequestV2Schema = z
  .object({
    meta: CompanionPresenceRequestMetaV2Schema,
    data: CompanionPresenceDataV2Schema,
  })
  .strict()

export const CompanionPresenceClearReasonV2Schema = z.enum([
  'paused',
  'sleep',
  'shutdown',
  'privacyChanged',
  'connectionRemoved',
])

export const CompanionPresenceClearDataV2Schema = z
  .object({ reason: CompanionPresenceClearReasonV2Schema })
  .strict()

export const CompanionPresenceClearRequestV2Schema = z
  .object({
    meta: CompanionPresenceRequestMetaV2Schema,
    data: CompanionPresenceClearDataV2Schema,
  })
  .strict()

export const PublicMediaPlaybackV2Schema = z
  .object({
    state: CompanionMediaPlaybackStateV2Schema,
    durationMs: NullableNonNegativeSafeIntegerSchema,
    positionMs: NullableNonNegativeSafeIntegerSchema,
    anchorAt: CompanionWireTimestampSchema,
    rate: z.number().min(0).max(4),
  })
  .strict()
  .superRefine((value, context) => validatePlayback(value, context, 0))

export const PublicMediaPresenceV2Schema = z
  .object({
    sessionId: CompanionIdentifierSchema,
    kind: CompanionMediaKindV2Schema,
    title: NullableMediaTextSchema,
    artist: NullableMediaTextSchema,
    album: NullableMediaTextSchema,
    player: CompanionPlayerV2Schema.nullable(),
    playback: PublicMediaPlaybackV2Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.title === null && value.artist === null) {
      addCustomIssue(
        context,
        ['title'],
        'Public media requires a title or artist.',
      )
    }
  })

export const PublicLiveDeskProjectionV2Schema = z
  .object({
    availability: LiveDeskAvailabilityV2Schema,
    updatedAt: CompanionWireTimestampSchema,
    expiresAt: CompanionWireTimestampSchema,
    application: CompanionApplicationContextV2Schema.nullable(),
    media: PublicMediaPresenceV2Schema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    validateAvailability(value, context)
    if (Date.parse(value.expiresAt) <= Date.parse(value.updatedAt)) {
      addCustomIssue(
        context,
        ['expiresAt'],
        'Public projection expiry must be later than its update time.',
      )
    }
  })

export const PublicLiveDeskStateV2Schema = z
  .object({
    schemaVersion: z.literal(COMPANION_PRESENCE_SCHEMA_VERSION),
    epoch: CompanionIdentifierSchema,
    revision: NonNegativeSafeIntegerSchema,
    projection: PublicLiveDeskProjectionV2Schema.nullable(),
  })
  .strict()

export const CompanionResponseMetaV2Schema = z
  .object({
    schema: z.literal(COMPANION_PRESENCE_SCHEMA),
    schemaVersion: z.literal(COMPANION_PRESENCE_SCHEMA_VERSION),
    requestId: CompanionIdentifierSchema,
    serverTime: CompanionWireTimestampSchema,
  })
  .strict()

export const CompanionPresenceMutationDataV2Schema = z
  .object({
    acceptedSequence: NonNegativeSafeIntegerSchema,
    receivedAt: CompanionWireTimestampSchema,
    state: PublicLiveDeskStateV2Schema,
  })
  .strict()

export const CompanionPresenceMutationResponseV2Schema = z
  .object({
    meta: CompanionResponseMetaV2Schema,
    data: CompanionPresenceMutationDataV2Schema,
  })
  .strict()

export const CompanionPublicPresenceDataV2Schema = z
  .object({ state: PublicLiveDeskStateV2Schema })
  .strict()

export const CompanionPublicPresenceResponseV2Schema = z
  .object({
    meta: CompanionResponseMetaV2Schema,
    data: CompanionPublicPresenceDataV2Schema,
  })
  .strict()

export const CompanionErrorV2Schema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
    retryAfterMs: NonNegativeSafeIntegerSchema.nullable(),
    acceptedSequence: NonNegativeSafeIntegerSchema.nullable(),
    fields: z.array(z.string()),
  })
  .strict()

export const CompanionFailureResponseV2Schema = z
  .object({
    meta: CompanionResponseMetaV2Schema,
    error: CompanionErrorV2Schema,
  })
  .strict()

export const CompanionCapabilitiesV2Schema = z
  .object({
    minimumClientVersion: z.string().refine(isSemVer),
    presenceSchemaVersions: z.array(PositiveSafeIntegerSchema).min(1),
    momentSchemaVersions: z.array(PositiveSafeIntegerSchema),
    features: z
      .object({
        liveDesk: z.boolean(),
        mediaTimeline: z.boolean(),
        moments: z.boolean(),
        readingSessions: z.boolean(),
      })
      .strict(),
    limits: z
      .object({
        presencePayloadBytes: z.number().int().positive(),
        presenceRequestsPerMinute: z.number().int().positive(),
        presenceLeaseMinSeconds: z.number().int().positive(),
        presenceLeaseMaxSeconds: z.number().int().positive(),
        recommendedHeartbeatSeconds: z.number().int().positive(),
        maximumClockSkewSeconds: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const { limits } = value
    if (limits.presenceLeaseMinSeconds > limits.presenceLeaseMaxSeconds) {
      addCustomIssue(
        context,
        ['limits', 'presenceLeaseMinSeconds'],
        'Presence lease minimum cannot exceed its maximum.',
      )
    }
    if (
      limits.recommendedHeartbeatSeconds < limits.presenceLeaseMinSeconds ||
      limits.recommendedHeartbeatSeconds > limits.presenceLeaseMaxSeconds
    ) {
      addCustomIssue(
        context,
        ['limits', 'recommendedHeartbeatSeconds'],
        'Recommended heartbeat must fit within the presence lease range.',
      )
    }
  })

export interface CompanionCapabilityFeatureConfiguration {
  mediaTimelineEnabled: boolean
}

export const createCompanionCapabilities = ({
  mediaTimelineEnabled,
}: CompanionCapabilityFeatureConfiguration) =>
  CompanionCapabilitiesV2Schema.parse({
    minimumClientVersion: COMPANION_MINIMUM_CLIENT_VERSION,
    presenceSchemaVersions: [COMPANION_PRESENCE_SCHEMA_VERSION],
    momentSchemaVersions: [],
    features: {
      liveDesk: true,
      mediaTimeline: mediaTimelineEnabled,
      moments: false,
      readingSessions: false,
    },
    limits: {
      presencePayloadBytes: COMPANION_PRESENCE_PAYLOAD_BYTES,
      presenceRequestsPerMinute: COMPANION_PRESENCE_REQUESTS_PER_MINUTE,
      presenceLeaseMinSeconds: COMPANION_PRESENCE_LEASE_MIN_SECONDS,
      presenceLeaseMaxSeconds: COMPANION_PRESENCE_LEASE_MAX_SECONDS,
      recommendedHeartbeatSeconds: COMPANION_RECOMMENDED_HEARTBEAT_SECONDS,
      maximumClockSkewSeconds: COMPANION_MAXIMUM_CLOCK_SKEW_SECONDS,
    },
  })

export const COMPANION_CAPABILITIES = createCompanionCapabilities({
  mediaTimelineEnabled: COMPANION_MEDIA_TIMELINE_ENABLED,
})

export const CompanionCapabilitiesResponseV2Schema = z
  .object({
    meta: CompanionResponseMetaV2Schema,
    data: CompanionCapabilitiesV2Schema,
  })
  .strict()
