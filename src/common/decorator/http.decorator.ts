import { applyDecorators, SetMetadata } from '@nestjs/common'
import { ApiBody, ApiConsumes } from '@nestjs/swagger'
import { HTTP_RES_TRANSFORM_PAGINATE } from '~/constants/meta.constant'
import * as SYSTEM from '~/constants/system.constant'
import { FileUploadDto } from '~/shared/dto/file.dto'
export const Paginator: MethodDecorator = (
  target,
  key,
  descriptor: PropertyDescriptor,
) => {
  SetMetadata(HTTP_RES_TRANSFORM_PAGINATE, true)(descriptor.value)
}

/**
 * @description 跳过响应体处理
 */
export const Bypass: MethodDecorator = (
  target,
  key,
  descriptor: PropertyDescriptor,
) => {
  SetMetadata(SYSTEM.RESPONSE_PASSTHROUGH_METADATA, true)(descriptor.value)
}

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

export const HTTPDecorators = {
  Paginator,
  Bypass,
  FileUpload,
}
