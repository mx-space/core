/*
 * @Author: Innei
 * @Date: 2021-01-01 13:25:04
 * @LastEditTime: 2021-03-12 11:13:52
 * @LastEditors: Innei
 * @FilePath: /server/libs/db/src/models/note.model.ts
 * Mark: Coding with Love
 */
import { AutoIncrementID } from '@typegoose/auto-increment'
import { index, modelOptions, plugin, prop } from '@typegoose/typegoose'
import { IsNumber } from 'class-validator'
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
  @prop({ required: true })
  type: string
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
  @prop({ required: false, unique: true })
  public nid: number

  @prop({ default: false })
  hide: boolean

  @prop({
    select: false,
  })
  password?: string

  @prop()
  secret?: Date

  @prop()
  mood?: string

  @prop()
  weather?: string

  @prop()
  hasMemory?: boolean

  @prop({ select: false, type: Coordinate })
  coordinates?: Coordinate

  @prop({ select: false })
  location?: string

  @prop({ type: CountMixed, default: { read: 0, like: 0 }, _id: false })
  count?: CountMixed

  @prop({ type: [NoteMusic] })
  music?: NoteMusic[]
}
