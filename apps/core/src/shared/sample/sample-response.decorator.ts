import type { Type } from '@nestjs/common'
import { SetMetadata } from '@nestjs/common'

export const SAMPLE_RESPONSE_METADATA = 'mx:sample-response'

export interface SampleResponseTarget {
  service: Type<unknown>
  method: string
}

export const SampleResponse = (
  service: SampleResponseTarget['service'],
  method: SampleResponseTarget['method'],
) =>
  SetMetadata<string, SampleResponseTarget>(SAMPLE_RESPONSE_METADATA, {
    service,
    method,
  })
