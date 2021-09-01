import { SetMetadata } from '@nestjs/common'
import { HTTP_RES_TRANSFORM_PAGINATE } from '~/constants/meta.constant'

export const Paginator: MethodDecorator = (
  target,
  key,
  descriptor: PropertyDescriptor,
) => {
  SetMetadata(HTTP_RES_TRANSFORM_PAGINATE, true)(descriptor.value)
}
