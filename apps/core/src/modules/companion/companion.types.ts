import type { z } from 'zod'

import type {
  CompanionApplicationContextV2Schema,
  CompanionCapabilitiesResponseV2Schema,
  CompanionCapabilitiesV2Schema,
  CompanionErrorV2Schema,
  CompanionFailureResponseV2Schema,
  CompanionMediaContextV2Schema,
  CompanionMediaKindV2Schema,
  CompanionMediaPlaybackStateV2Schema,
  CompanionMediaPlaybackV2Schema,
  CompanionPresenceClearDataV2Schema,
  CompanionPresenceClearReasonV2Schema,
  CompanionPresenceClearRequestV2Schema,
  CompanionPresenceDataV2Schema,
  CompanionPresenceMutationResponseV2Schema,
  CompanionPresenceRequestMetaV2Schema,
  CompanionPresenceRequestV2Schema,
  CompanionPublicPresenceDataV2Schema,
  CompanionPublicPresenceResponseV2Schema,
  CompanionResponseMetaV2Schema,
  LiveDeskAvailabilityV2Schema,
  PublicLiveDeskProjectionV2Schema,
  PublicLiveDeskStateV2Schema,
  PublicMediaPlaybackV2Schema,
  PublicMediaPresenceV2Schema,
} from './companion.schema'

export type CompanionPresenceRequestMetaV2 = z.output<
  typeof CompanionPresenceRequestMetaV2Schema
>
export type CompanionPresenceDataInputV2 = z.input<
  typeof CompanionPresenceDataV2Schema
>
export type CompanionPresenceDataV2 = z.output<
  typeof CompanionPresenceDataV2Schema
>
export type CompanionPresenceRequestInputV2 = z.input<
  typeof CompanionPresenceRequestV2Schema
>
export type CompanionPresenceRequestV2 = z.output<
  typeof CompanionPresenceRequestV2Schema
>
export type CompanionPresenceClearRequestV2 = z.output<
  typeof CompanionPresenceClearRequestV2Schema
>
export type CompanionPresenceClearDataV2 = z.output<
  typeof CompanionPresenceClearDataV2Schema
>
export type CompanionPresenceClearReasonV2 = z.output<
  typeof CompanionPresenceClearReasonV2Schema
>
export type LiveDeskAvailabilityV2 = z.output<
  typeof LiveDeskAvailabilityV2Schema
>
export type CompanionMediaKindV2 = z.output<typeof CompanionMediaKindV2Schema>
export type CompanionMediaPlaybackStateV2 = z.output<
  typeof CompanionMediaPlaybackStateV2Schema
>
export type CompanionApplicationContextV2 = z.output<
  typeof CompanionApplicationContextV2Schema
>
export type CompanionMediaContextV2 = z.output<
  typeof CompanionMediaContextV2Schema
>
export type CompanionMediaPlaybackV2 = z.output<
  typeof CompanionMediaPlaybackV2Schema
>
export type PublicMediaPlaybackV2 = z.output<typeof PublicMediaPlaybackV2Schema>
export type PublicMediaPresenceV2 = z.output<typeof PublicMediaPresenceV2Schema>
export type PublicLiveDeskProjectionV2 = z.output<
  typeof PublicLiveDeskProjectionV2Schema
>
export type PublicLiveDeskStateV2 = z.output<typeof PublicLiveDeskStateV2Schema>
export type CompanionResponseMetaV2 = z.output<
  typeof CompanionResponseMetaV2Schema
>
export type CompanionPresenceMutationResponseV2 = z.output<
  typeof CompanionPresenceMutationResponseV2Schema
>
export type CompanionPublicPresenceDataV2 = z.output<
  typeof CompanionPublicPresenceDataV2Schema
>
export type CompanionPublicPresenceResponseV2 = z.output<
  typeof CompanionPublicPresenceResponseV2Schema
>
export type CompanionErrorV2 = z.output<typeof CompanionErrorV2Schema>
export type CompanionFailureResponseV2 = z.output<
  typeof CompanionFailureResponseV2Schema
>
export type CompanionCapabilitiesV2 = z.output<
  typeof CompanionCapabilitiesV2Schema
>
export type CompanionCapabilitiesResponseV2 = z.output<
  typeof CompanionCapabilitiesResponseV2Schema
>
