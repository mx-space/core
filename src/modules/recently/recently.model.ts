import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator'

import { modelOptions, prop } from '@typegoose/typegoose'

import { BaseModel } from '~/shared/model/base.model'

import { CommentRefTypes } from '../comment/comment.model'

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

  @prop({ refPath: 'refType' })
  @IsOptional()
  @IsMongoId()
  ref: RefType

  @prop({ enum: CommentRefTypes })
  @IsEnum(CommentRefTypes)
  @ValidateIf((model) => model.ref)
  refType: CommentRefTypes

  get refId() {
    return (this.ref as any)?._id ?? this.ref
  }

  set refId(id: string) {
    return
    // if (!id) {
    //   return
    // }
    // if (this.ref) {
    //   ;(this.ref as any)._id = id
    // } else {
    //   this.ref = id as any
    // }
  }
}
