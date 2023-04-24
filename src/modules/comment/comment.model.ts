import { Types } from 'mongoose'
import autopopulate from 'mongoose-autopopulate'
import { URL } from 'url'

import { Ref, modelOptions, plugin, prop } from '@typegoose/typegoose'

import { BaseModel } from '~/shared/model/base.model'
import { getAvatar } from '~/utils'

import { NoteModel } from '../note/note.model'
import { PageModel } from '../page/page.model'
import { PostModel } from '../post/post.model'
import { RecentlyModel } from '../recently/recently.model'

export enum CommentRefTypes {
  Post = 'Post',
  Note = 'Note',
  Page = 'Page',
  Recently = 'Recently',
}

export enum CommentState {
  Unread,
  Read,
  Junk,
}

@modelOptions({
  options: {
    customName: 'Comment',
  },
})
@plugin(autopopulate)
export class CommentModel extends BaseModel {
  @prop({ refPath: 'refType' })
  ref: Ref<PostModel | NoteModel | PageModel | RecentlyModel>

  @prop({ required: true, default: 'Post', enum: CommentRefTypes })
  refType: CommentRefTypes

  @prop({ trim: true, required: true })
  author!: string

  @prop({ trim: true })
  mail: string

  @prop({
    trim: true,
    set(val) {
      try {
        return new URL(val).origin
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

  @prop({ ref: () => CommentModel, type: Types.ObjectId })
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

  _avatar?: string
  public get avatar() {
    return this._avatar ?? getAvatar(this.mail)
  }

  set avatar(value: string) {
    this._avatar = value
  }
}
