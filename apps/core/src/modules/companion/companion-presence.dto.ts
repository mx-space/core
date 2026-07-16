import { createZodDto } from 'nestjs-zod'

import {
  CompanionPresenceClearRequestV2Schema,
  CompanionPresenceRequestV2Schema,
} from './companion.schema'

export class CompanionPresenceRequestV2Dto extends createZodDto(
  CompanionPresenceRequestV2Schema,
) {}

export class CompanionPresenceClearRequestV2Dto extends createZodDto(
  CompanionPresenceClearRequestV2Schema,
) {}
