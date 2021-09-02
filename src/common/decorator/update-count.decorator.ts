import { SetMetadata } from '@nestjs/common'
import { ArticleType } from '~/constants/article.constant'
import { HTTP_RES_UPDATE_DOC_COUNT_TYPE } from '~/constants/meta.constant'

export const UpdateDocumentCount: (
  type: keyof typeof ArticleType,
) => MethodDecorator = (type) => {
  return (_, __, descriptor: any) => {
    SetMetadata(HTTP_RES_UPDATE_DOC_COUNT_TYPE, type)(descriptor.value)
  }
}
