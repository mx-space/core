import { SetMetadata } from '@nestjs/common'
import {
  HTTP_IDEMPOTENCE_OPTIONS,
  HTTP_RES_TRANSFORM_PAGINATE,
} from '~/constants/meta.constant'
import * as SYSTEM from '~/constants/system.constant'
import type { IdempotenceOption } from '../interceptors/idempotence.interceptor'

/**
 * @description 分页转换
 */
export const Paginator: MethodDecorator = (
  target,
  key,
  descriptor: PropertyDescriptor,
) => {
  SetMetadata(HTTP_RES_TRANSFORM_PAGINATE, true)(descriptor.value)
}

/**
 * @description 跳过响应体处理，JSON 格式的响应体
 */
export const Bypass = SetMetadata(SYSTEM.RESPONSE_PASSTHROUGH_METADATA, true)

export declare interface FileDecoratorProps {
  description: string
}

/**
 * 幂等
 */
export const Idempotence: (options?: IdempotenceOption) => MethodDecorator =
  (options) => (target, key, descriptor: PropertyDescriptor) => {
    SetMetadata(HTTP_IDEMPOTENCE_OPTIONS, options || {})(descriptor.value)
  }

export const SkipLogging = SetMetadata(SYSTEM.SKIP_LOGGING_METADATA, true)
export const HTTPDecorators = {
  Paginator,
  Bypass,
  Idempotence,
  SkipLogging,
}
