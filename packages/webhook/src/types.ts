import type { EventEmitter } from 'node:events'
import type { CommentModel } from '@core/modules/comment/comment.model'
import type { LinkModel } from '@core/modules/link/link.model'
import type { NoteModel } from '@core/modules/note/note.model'
import type { NormalizedNote } from '@core/modules/note/note.type'
import type { PageModel } from '@core/modules/page/page.model'
import type { PostModel } from '@core/modules/post/post.model'
import type { NormalizedPost } from '@core/modules/post/post.type'
import type { RecentlyModel } from '@core/modules/recently/recently.model'
import type { SayModel } from '@core/modules/say/say.model'
import type { ReaderModel } from '~/modules/reader/reader.model'
import type { BusinessEvents } from './event.enum'

export interface ExtendedEventEmitter extends EventEmitter {
  on: (<T extends BusinessEvents>(
    event: T,
    listener: (
      data: EventPayloadMapping[Extract<T, keyof EventPayloadMapping>],
    ) => void,
  ) => this) &
    ((event: '*', listener: (event: GenericEvent) => void) => this)
}
export type Id = string
export type PayloadOnlyId = { data: Id }
export interface EventPayloadMapping {
  [BusinessEvents.POST_CREATE]: NormalizedPost
  [BusinessEvents.POST_UPDATE]: NormalizedPost
  [BusinessEvents.POST_DELETE]: PayloadOnlyId

  [BusinessEvents.NOTE_CREATE]: NormalizedNote
  [BusinessEvents.NOTE_UPDATE]: NormalizedNote
  [BusinessEvents.NOTE_DELETE]: PayloadOnlyId

  [BusinessEvents.PAGE_CREATE]: PageModel
  [BusinessEvents.PAGE_UPDATE]: PageModel
  [BusinessEvents.PAGE_DELETE]: PayloadOnlyId

  [BusinessEvents.SAY_CREATE]: SayModel
  [BusinessEvents.SAY_UPDATE]: SayModel
  [BusinessEvents.SAY_DELETE]: PayloadOnlyId

  [BusinessEvents.RECENTLY_CREATE]: RecentlyModel

  [BusinessEvents.ACTIVITY_LIKE]: IActivityLike

  [BusinessEvents.LINK_APPLY]: LinkModel

  [BusinessEvents.COMMENT_CREATE]: Omit<CommentModel, 'ref'> & {
    ref: Id | PostModel | PageModel | NoteModel | RecentlyModel
  }

  [BusinessEvents.COMMENT_UPDATE]: {
    id: string
    text: string
  }

  [BusinessEvents.ARTICLE_READ_COUNT_UPDATE]: {
    count: number
    type: 'post' | 'note'
    id: string
  }
  health_check: {}
}

export interface IActivityLike {
  id: string
  type: 'Note' | 'Post'
  created: string
  ref: {
    id: string
    title: string
    readerId?: string
  }
  reader?: ReaderModel
}

// Auto Generaged type.
export type GenericEvent =
  | { type: BusinessEvents.POST_CREATE; payload: NormalizedPost }
  | { type: BusinessEvents.POST_UPDATE; payload: NormalizedPost }
  | { type: BusinessEvents.POST_DELETE; payload: PayloadOnlyId }
  | { type: BusinessEvents.NOTE_CREATE; payload: NormalizedNote }
  | { type: BusinessEvents.NOTE_UPDATE; payload: NormalizedNote }
  | { type: BusinessEvents.NOTE_DELETE; payload: PayloadOnlyId }
  | { type: BusinessEvents.PAGE_CREATE; payload: PageModel }
  | { type: BusinessEvents.PAGE_UPDATE; payload: PageModel }
  | { type: BusinessEvents.PAGE_DELETE; payload: PayloadOnlyId }
  | { type: BusinessEvents.SAY_CREATE; payload: SayModel }
  | { type: BusinessEvents.SAY_UPDATE; payload: SayModel }
  | { type: BusinessEvents.SAY_DELETE; payload: PayloadOnlyId }
  | { type: BusinessEvents.RECENTLY_CREATE; payload: RecentlyModel }
  | { type: BusinessEvents.ACTIVITY_LIKE; payload: IActivityLike }
  | { type: BusinessEvents.LINK_APPLY; payload: LinkModel }
  | {
      type: BusinessEvents.COMMENT_CREATE
      payload: Omit<CommentModel, 'ref'> & {
        ref: Id | PostModel | PageModel | NoteModel | RecentlyModel
      }
    }
  | {
      type: BusinessEvents.COMMENT_UPDATE
      payload: {
        id: string
        text: string
      }
    }
  | {
      type: BusinessEvents.ARTICLE_READ_COUNT_UPDATE
      payload: {
        count: number
        type: 'post' | 'note'
        id: string
      }
    }
  | { type: 'health_check'; payload: {} }
