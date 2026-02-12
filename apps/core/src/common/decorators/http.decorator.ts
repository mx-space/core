import { SetMetadata } from '@nestjs/common'
import {
  HTTP_IDEMPOTENCE_OPTIONS,
  HTTP_RES_TRANSFORM_PAGINATE,
} from '~/constants/meta.constant'
import * as SYSTEM from '~/constants/system.constant'
import type { IdempotenceOption } from '../interceptors/idempotence.interceptor'

export const Paginator: MethodDecorator = (
  _target,
  _key,
  descriptor: PropertyDescriptor,
) => {
  SetMetadata(HTTP_RES_TRANSFORM_PAGINATE, true)(descriptor.value)
}

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
  Paginator,
  Bypass,
  Idempotence,
  SkipLogging,
}
