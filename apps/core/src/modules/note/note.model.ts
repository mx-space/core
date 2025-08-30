import { PartialType } from '@nestjs/mapped-types'
import { AutoIncrementID } from '@typegoose/auto-increment'
import { index, modelOptions, plugin, prop, Ref } from '@typegoose/typegoose'
import { NOTE_COLLECTION_NAME } from '~/constants/db.constant'
import { TransformEmptyNull } from '~/decorators/dto/transformEmptyNull'
import { CountModel } from '~/shared/model/count.model'
import { WriteBaseModel } from '~/shared/model/write-base.model'
import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsDate,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { TopicModel } from '../topic/topic.model'
import { Coordinate } from './models/coordinate.model'

@modelOptions({
  options: {
    customName: NOTE_COLLECTION_NAME,
  },
})
@plugin(AutoIncrementID, {
  field: 'nid',
  startAt: 1,
  overwriteModelName: NOTE_COLLECTION_NAME,
  trackerModelName: 'identitycounters',
})
@index({ text: 'text' })
@index({ modified: -1 })
@index({ nid: -1 })
@plugin(mongooseAutoPopulate)
export class NoteModel extends WriteBaseModel {
  @prop()
  @IsString()
  @Transform(({ value: title }) => (title.length === 0 ? '无题' : title))
  declare title: string
  @prop({ required: false, unique: true })
  public nid: number

  @prop({ default: true })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean

  @prop({
    select: false,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @TransformEmptyNull()
  password: string | null

  @prop({ type: Date })
  @IsOptional()
  @IsDate()
  @Transform(({ value }) => (value ? new Date(value) : null))
  publicAt: Date | null

  @prop()
  @IsString()
  @IsOptional()
  mood?: string

  @prop()
  @IsOptional()
  @IsString()
  weather?: string

  @prop({ default: false })
  @IsBoolean()
  @IsOptional()
  bookmark: boolean

  @prop({ select: false, type: Coordinate })
  @ValidateNested()
  @Type(() => Coordinate)
  @IsOptional()
  coordinates?: Coordinate

  @prop({ select: false })
  @IsString()
  @IsOptional()
  location?: string

  @prop({ type: CountModel, default: { read: 0, like: 0 }, _id: false })
  count: CountModel

  @prop({ ref: () => TopicModel })
  @IsMongoId()
  @IsOptional()
  topicId?: Ref<TopicModel>

  @prop({
    justOne: true,
    foreignField: '_id',
    localField: 'topicId',
    ref: () => TopicModel,
    autopopulate: true,
  })
  topic?: TopicModel

  static get protectedKeys() {
    return ['nid', 'count'].concat(super.protectedKeys)
  }
}

export class PartialNoteModel extends PartialType(NoteModel) {}
