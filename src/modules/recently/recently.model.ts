import { IsMongoId, IsOptional, IsString } from 'class-validator'

import { modelOptions, prop } from '@typegoose/typegoose'

import { BaseModel } from '~/shared/model/base.model'

export type RefType = {
  title: string
  url: string
}

@modelOptions({
  options: {
    customName: 'Recently',
  },
})
export class RecentlyModel extends BaseModel {
  @prop({ required: true })
  @IsString()
  content: string
  @prop()
  @IsOptional()
  @IsMongoId()
  refId?: string

  ref?: RefType

  /**
   * @deprecated
   */
  @prop()
  @IsOptional()
  @IsString()
  project?: string
  /**
   * @deprecated
   */
  @prop()
  @IsString()
  @IsOptional()
  language?: string
}
