import { ApiHideProperty } from '@nestjs/swagger'
import { modelOptions, prop } from '@typegoose/typegoose'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'
export class BaseModel {
  @ApiHideProperty()
  created?: Date
}

@modelOptions({
  schemaOptions: { _id: false },
})
class Image {
  @prop()
  width?: number

  @prop()
  height?: number

  @prop()
  accent?: string

  @prop()
  type?: string

  @prop()
  src: string
}

export abstract class BaseCommentIndexModel extends BaseModel {
  @prop({ default: 0 })
  @ApiHideProperty()
  commentsIndex?: number

  @prop({ default: true })
  @IsBoolean()
  @IsOptional()
  allowComment: boolean
}

export abstract class WriteBaseModel extends BaseCommentIndexModel {
  @prop({ trim: true, index: true, required: true })
  @IsString()
  @IsNotEmpty()
  title: string

  @prop({ trim: true })
  @IsString()
  text: string

  @prop({ type: Image })
  @ApiHideProperty()
  images?: Image[]

  @prop({ default: null })
  @ApiHideProperty()
  modified: Date | null
}

@modelOptions({
  schemaOptions: { id: false, _id: false },
  options: { customName: 'count' },
})
export class CountMixed {
  @prop({ default: 0 })
  read?: number

  @prop({ default: 0 })
  like?: number
}
