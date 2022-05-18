import { IsOptional, IsString, MaxLength } from 'class-validator'

import { index, modelOptions, prop } from '@typegoose/typegoose'

import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  options: {
    customName: 'Topic',
  },
})
@index({ name: 1 })
export class TopicModel extends BaseModel {
  @prop({ default: '' })
  @MaxLength(400, { message: '描述信息最多 400 个字符' })
  @IsOptional()
  @IsString({ message: '描述信息必须是字符串' })
  description?: string

  @prop()
  @IsString({ message: '简介必须是字符串' })
  introduce: string

  @prop({ unique: true })
  name: string

  @prop({ unique: true })
  id: string
}
