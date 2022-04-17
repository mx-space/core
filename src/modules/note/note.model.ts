import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

import { PartialType } from '@nestjs/mapped-types'
import { AutoIncrementID } from '@typegoose/auto-increment'
import { index, modelOptions, plugin, prop } from '@typegoose/typegoose'

import { Paginator } from '~/shared/interface/paginator.interface'
import { CountMixed, WriteBaseModel } from '~/shared/model/base.model'

@modelOptions({ schemaOptions: { id: false, _id: false } })
export class Coordinate {
  @IsNumber()
  @prop()
  latitude: number
  @prop()
  @IsNumber()
  longitude: number
}

@modelOptions({
  schemaOptions: {
    id: false,
    _id: false,
  },
})
export class NoteMusic {
  @IsString()
  @IsNotEmpty()
  @prop({ required: true })
  type: string

  @IsString()
  @IsNotEmpty()
  @prop({ required: true })
  id: string
}

@modelOptions({
  options: {
    customName: 'Note',
  },
})
@plugin(AutoIncrementID, {
  field: 'nid',
  startAt: 1,
})
@index({ text: 'text' })
@index({ modified: -1 })
@index({ nid: -1 })
export class NoteModel extends WriteBaseModel {
  @prop()
  @IsString()
  @IsOptional()
  @Transform(({ value: title }) => (title.length === 0 ? '无题' : title))
  title: string
  @prop({ required: false, unique: true })
  public nid: number

  @prop({ default: false })
  @IsBoolean()
  @IsOptional()
  hide: boolean

  @prop({
    select: false,
  })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @Transform(({ value: val }) => (String(val).length === 0 ? null : val))
  password?: string

  @prop()
  @IsOptional()
  @IsDate()
  @Transform(({ value }) => (value ? new Date(value) : null))
  secret?: Date

  @prop()
  @IsString()
  @IsOptional()
  mood?: string

  @prop()
  @IsOptional()
  @IsString()
  weather?: string

  @prop()
  @IsBoolean()
  @IsOptional()
  hasMemory?: boolean

  @prop({ select: false, type: Coordinate })
  @ValidateNested()
  @Type(() => Coordinate)
  @IsOptional()
  coordinates?: Coordinate

  @prop({ select: false })
  @IsString()
  @IsOptional()
  location?: string

  @prop({ type: CountMixed, default: { read: 0, like: 0 }, _id: false })
  count?: CountMixed

  @prop({ type: [NoteMusic] })
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => NoteMusic)
  music?: NoteMusic[]

  static get protectedKeys() {
    return ['nid', 'count'].concat(super.protectedKeys)
  }
}

export class PartialNoteModel extends PartialType(NoteModel) {}

export class NoteItemAggregateModel {
  data: NoteModel

  prev?: NoteModel

  next?: NoteModel
}

export class NotePaginatorModel {
  data: NoteModel[]
  pagination: Paginator
}
