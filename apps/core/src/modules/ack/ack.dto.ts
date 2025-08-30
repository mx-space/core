import { ArticleTypeEnum } from '~/constants/article.constant'
import { IsEnum, IsMongoId, IsObject } from 'class-validator'

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
