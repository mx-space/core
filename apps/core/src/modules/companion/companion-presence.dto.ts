import type { z } from 'zod'

import {
  CompanionMomentRequestV1Schema,
  CompanionPresenceClearRequestV2Schema,
  CompanionPresenceRequestV2Schema,
} from './companion.schema'

export {
  CompanionMomentRequestV1Schema,
  CompanionPresenceClearRequestV2Schema,
  CompanionPresenceRequestV2Schema,
}

export type CompanionMomentRequestV1Dto = z.infer<
  typeof CompanionMomentRequestV1Schema
>

export type CompanionPresenceRequestV2Dto = z.infer<
  typeof CompanionPresenceRequestV2Schema
>

export type CompanionPresenceClearRequestV2Dto = z.infer<
  typeof CompanionPresenceClearRequestV2Schema
>
