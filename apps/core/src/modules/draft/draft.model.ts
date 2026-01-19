import { index, modelOptions, prop, PropType } from '@typegoose/typegoose'
import { DRAFT_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'
import { ImageModel } from '~/shared/model/image.model'
import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'
import { Types } from 'mongoose'

export enum DraftRefType {
  Post = 'posts',
  Note = 'notes',
  Page = 'pages',
}

@modelOptions({
  schemaOptions: { _id: false },
})
export class DraftHistoryModel {
  @prop({ required: true })
  version: number

  @prop({ required: true })
  title: string

  @prop({ required: true })
  text: string

  @prop({ type: String })
  typeSpecificData?: string

  @prop({ required: true })
  savedAt: Date
}

@index({ refType: 1, refId: 1 }, { sparse: true })
@index({ updated: -1 })
@modelOptions({
  options: { customName: DRAFT_COLLECTION_NAME },
  schemaOptions: {
    timestamps: {
      createdAt: 'created',
      updatedAt: 'updated',
    },
  },
})
export class DraftModel extends BaseModel {
  @prop({ required: true, enum: DraftRefType })
  @IsEnum(DraftRefType)
  refType: DraftRefType

  @prop({ type: Types.ObjectId })
  @IsOptional()
  @Transform(({ value }) =>
    value ? Types.ObjectId.createFromHexString(value) : undefined,
  )
  refId?: Types.ObjectId

  @prop({ trim: true, default: '' })
  @IsString()
  @IsOptional()
  title: string

  @prop({ trim: true, default: '' })
  @IsString()
  @IsOptional()
  text: string

  @prop({ type: ImageModel })
  @IsOptional()
  @ValidateNested()
  @Type(() => ImageModel)
  images?: ImageModel[]

  @prop(
    {
      type: String,
      get(jsonString) {
        return JSON.safeParse(jsonString)
      },
      set(val) {
        return JSON.stringify(val)
      },
    },
    PropType.NONE,
  )
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>

  @prop({ type: String })
  @IsOptional()
  @IsObject()
  @Transform(({ value }) =>
    typeof value === 'string' ? value : JSON.stringify(value),
  )
  typeSpecificData?: string

  @prop({ default: 1 })
  version: number

  @prop()
  updated?: Date

  @prop({ type: () => [DraftHistoryModel], default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftHistoryModel)
  history: DraftHistoryModel[]

  static get protectedKeys() {
    return ['version', 'history', 'updated'].concat(super.protectedKeys)
  }
}
