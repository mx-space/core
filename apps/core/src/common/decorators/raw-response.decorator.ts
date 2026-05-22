import { SetMetadata } from '@nestjs/common'

import { RESPONSE_PASSTHROUGH_METADATA } from '~/constants/system.constant'

export const RawResponse = SetMetadata(RESPONSE_PASSTHROUGH_METADATA, true)
