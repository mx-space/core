import { IsEnum, IsMongoId, IsObject } from 'class-validator'

import { ArticleTypeEnum } from '~/constants/article.constant'

export enum AckEventType {
  READ = 'read',
}

export class AckDto {
  @IsEnum(AckEventType)
  type: AckEventType

  @IsObject()
  payload: any
}

export class AckReadPayloadDto {
  @IsEnum(ArticleTypeEnum)
  type: ArticleTypeEnum

  @IsMongoId()
  id: string
}
