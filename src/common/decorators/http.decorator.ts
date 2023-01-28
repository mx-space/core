import { SetMetadata, applyDecorators } from '@nestjs/common'
import { ApiBody, ApiConsumes } from '@nestjs/swagger'

import {
  HTTP_IDEMPOTENCE_OPTIONS,
  HTTP_RES_TRANSFORM_PAGINATE,
} from '~/constants/meta.constant'
import * as SYSTEM from '~/constants/system.constant'
import { FileUploadDto } from '~/shared/dto/file.dto'

import { IdempotenceOption } from '../interceptors/idempotence.interceptor'

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

export function FileUpload({ description }: FileDecoratorProps) {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      description,
      type: FileUploadDto,
    }),
  )
}

/**
 * 幂等
 */
export const Idempotence: (options?: IdempotenceOption) => MethodDecorator =
  (options) => (target, key, descriptor: PropertyDescriptor) => {
    SetMetadata(HTTP_IDEMPOTENCE_OPTIONS, options || {})(descriptor.value)
  }
export const HTTPDecorators = {
  Paginator,
  Bypass,
  FileUpload,
  Idempotence,
}
