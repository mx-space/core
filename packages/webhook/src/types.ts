import type { CommentModel } from '@core/modules/comment/comment.model'
import type { LinkModel } from '@core/modules/link/link.model'
import type { NoteModel } from '@core/modules/note/note.model'
import type { NormalizedNote } from '@core/modules/note/note.type'
import type { PageModel } from '@core/modules/page/page.model'
import type { PostModel } from '@core/modules/post/post.model'
import type { NormalizedPost } from '@core/modules/post/post.type'
import type { RecentlyModel } from '@core/modules/recently/recently.model'
import type { SayModel } from '@core/modules/say/say.model'
import type { EventEmitter } from 'events'
import type { BusinessEvents } from './event.enum'

export interface ExtendedEventEmitter extends EventEmitter {
  on<T extends BusinessEvents>(
    event: T,
    listener: (
      data: EventPayloadMapping[Extract<T, keyof EventPayloadMapping>],
    ) => void,
  ): this
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
  [BusinessEvents.RECENTLY_CREATE]: RecentlyModel

  [BusinessEvents.ACTIVITY_LIKE]: IActivityLike

  [BusinessEvents.LINK_APPLY]: LinkModel

  [BusinessEvents.COMMENT_CREATE]: Omit<CommentModel, 'ref'> & {
    ref: Id | PostModel | PageModel | NoteModel | RecentlyModel
  }
}
export interface IActivityLike {
  id: string
  type: 'Note' | 'Post'
  created: string
  ref: {
    id: string
    title: string
  }
}
