import { AutoIncrementID } from '@typegoose/auto-increment'
import { index, modelOptions, plugin, prop } from '@typegoose/typegoose'
import type { Ref } from '@typegoose/typegoose'
import { NOTE_COLLECTION_NAME } from '~/constants/db.constant'
import { CountModel } from '~/shared/model/count.model'
import { WriteBaseModel } from '~/shared/model/write-base.model'
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
  declare title: string

  @prop({ required: false, unique: true })
  public nid: number

  @prop({ default: true })
  isPublished?: boolean

  @prop({
    select: false,
    type: String,
  })
  password: string | null

  @prop({ type: Date })
  publicAt: Date | null

  @prop()
  mood?: string

  @prop()
  weather?: string

  @prop({ default: false })
  bookmark: boolean

  @prop({ select: false, type: Coordinate })
  coordinates?: Coordinate

  @prop({ select: false })
  location?: string

  @prop({ type: CountModel, default: { read: 0, like: 0 }, _id: false })
  count: CountModel

  @prop({ ref: () => TopicModel })
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
