import { createZodDto } from 'nestjs-zod'

import {
  CompanionMomentRequestV1Schema,
  CompanionPresenceClearRequestV2Schema,
  CompanionPresenceRequestV2Schema,
} from './companion.schema'

export class CompanionMomentRequestV1Dto extends createZodDto(
  CompanionMomentRequestV1Schema,
) {}

export class CompanionPresenceRequestV2Dto extends createZodDto(
  CompanionPresenceRequestV2Schema,
) {}

export class CompanionPresenceClearRequestV2Dto extends createZodDto(
  CompanionPresenceClearRequestV2Schema,
) {}
