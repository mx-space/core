import { modelOptions, pre, prop, Ref } from '@typegoose/typegoose'
import { Types } from 'mongoose'
import { BaseModel } from '~/shared/model/base.model'
import { getAvatar } from '~/utils/index.util'
import { NoteModel } from '../note/note.model'
import { PageModel } from '../page/page.model'
import { PostModel } from '../post/post.model'

function autoPopulateSubs(next: () => void) {
  this.populate({ options: { sort: { created: -1 } }, path: 'children' })
  next()
}

export enum CommentRefTypes {
  Post = 'Post',
  Note = 'Note',
  Page = 'Page',
}

export enum CommentState {
  Unread,
  Read,
  Junk,
}

@pre<Comment>('findOne', autoPopulateSubs)
@pre<Comment>('find', autoPopulateSubs)
@modelOptions({
  options: {
    customName: 'Comment',
  },
})
export class CommentModel extends BaseModel {
  @prop({ refPath: 'refType' })
  ref: Ref<PostModel | NoteModel | PageModel>

  @prop({ required: true, default: 'PostModel', enum: CommentRefTypes })
  refType: CommentRefTypes

  @prop({ trim: true, required: true })
  author!: string

  @prop({ trim: true })
  mail?: string

  @prop({ trim: true })
  url?: string

  @prop({ required: true })
  text!: string

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

  public get avatar() {
    return getAvatar(this.mail)
  }
}
