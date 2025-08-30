import { URL } from 'node:url'
import { modelOptions, plugin, prop, Ref } from '@typegoose/typegoose'
import {
  CollectionRefTypes,
  COMMENT_COLLECTION_NAME,
} from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'
import { Types } from 'mongoose'
import autopopulate from 'mongoose-autopopulate'
import { NoteModel } from '../note/note.model'
import { PageModel } from '../page/page.model'
import { PostModel } from '../post/post.model'
import { RecentlyModel } from '../recently/recently.model'

export enum CommentState {
  Unread,
  Read,
  Junk,
}

@modelOptions({
  options: {
    customName: COMMENT_COLLECTION_NAME,
  },
})
@plugin(autopopulate)
export class CommentModel extends BaseModel {
  @prop({ refPath: 'refType' })
  ref: Ref<PostModel | NoteModel | PageModel | RecentlyModel>

  @prop({ required: true, type: String })
  refType: CollectionRefTypes

  @prop({ trim: true, required: true })
  author!: string

  @prop({ trim: true })
  mail: string

  @prop({
    trim: true,
    set(val) {
      try {
        return new URL(val).toString()
      } catch {
        return '#'
      }
    },
  })
  url?: string

  @prop({ required: true })
  text: string

  // 0 : 未读
  // 1 : 已读
  // 2 : 垃圾
  @prop({ default: 0 })
  state?: CommentState

  @prop({ ref: () => CommentModel })
  parent?: Ref<CommentModel>

  @prop({ ref: () => CommentModel, type: Types.ObjectId, autopopulate: true })
  children?: Ref<CommentModel>[]

  @prop({ default: 1 })
  commentsIndex?: number
  @prop()
  key?: string
  @prop({ select: false })
  ip?: string

  @prop({ select: false })
  agent?: string

  @prop({ default: false })
  pin?: boolean

  @prop({
    ref: () => PostModel,
    foreignField: '_id',
    localField: 'ref',
    justOne: true,
  })
  public post: Ref<PostModel>

  @prop({
    ref: () => NoteModel,
    foreignField: '_id',
    localField: 'ref',
    justOne: true,
  })
  public note: Ref<NoteModel>

  @prop({
    ref: () => PageModel,
    foreignField: '_id',
    localField: 'ref',
    justOne: true,
  })
  public page: Ref<PageModel>

  @prop({
    ref: () => RecentlyModel,
    foreignField: '_id',
    localField: 'ref',
    justOne: true,
  })
  public recently: Ref<RecentlyModel>

  // IP 归属记录值
  @prop()
  public location?: string

  // 悄悄话
  @prop({ default: false })
  isWhispers?: boolean

  @prop()
  source?: string

  @prop()
  avatar?: string

  @prop()
  meta?: string
  @prop({})
  readerId?: string
  @prop()
  editedAt?: Date
}
