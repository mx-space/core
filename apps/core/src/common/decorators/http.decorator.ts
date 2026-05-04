import { SetMetadata } from '@nestjs/common'

import { HTTP_IDEMPOTENCE_OPTIONS } from '~/constants/meta.constant'
import * as SYSTEM from '~/constants/system.constant'

import type { IdempotenceOption } from '../interceptors/idempotence.interceptor'

export const Bypass = SetMetadata(SYSTEM.RESPONSE_PASSTHROUGH_METADATA, true)

export declare interface FileDecoratorProps {
  description: string
}

export const Idempotence: (options?: IdempotenceOption) => MethodDecorator =
  (options) => (_target, _key, descriptor: PropertyDescriptor) => {
    SetMetadata(HTTP_IDEMPOTENCE_OPTIONS, options || {})(descriptor.value)
  }

export const SkipLogging = SetMetadata(SYSTEM.SKIP_LOGGING_METADATA, true)

export const HTTPDecorators = {
  Bypass,
  Idempotence,
  SkipLogging,
}
