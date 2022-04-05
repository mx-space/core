import { IsOptional, IsString } from 'class-validator'

import { modelOptions, prop } from '@typegoose/typegoose'

import { BaseModel } from '~/shared/model/base.model'

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
  @IsString()
  project?: string
  @prop()
  @IsString()
  @IsOptional()
  language?: string
}
