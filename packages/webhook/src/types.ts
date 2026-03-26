import type { EventEmitter } from 'node:events'

import type { BusinessEvents } from './event.enum'
import type {
  CommentModel,
  LinkModel,
  NormalizedNote,
  NormalizedPost,
  NoteModel,
  PageModel,
  PostModel,
  ReaderModel,
  RecentlyModel,
  SayModel,
} from './models.generated'

export type WebhookEventSource = 'admin' | 'visitor' | 'system'

export interface ExtendedEventEmitter extends EventEmitter {
  on: (<T extends BusinessEvents>(
    event: T,
    listener: (
      data: EventPayloadMapping[Extract<T, keyof EventPayloadMapping>],
      source: WebhookEventSource,
    ) => void,
  ) => this) &
    ((event: '*', listener: (event: GenericEvent) => void) => this)
}
export type Id = string
export type PayloadOnlyId = { data: Id }
export interface AggregateUpdatePayload {
  source: 'config' | 'owner' | 'theme'
  keys: string[]
}
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
  [BusinessEvents.RECENTLY_UPDATE]: RecentlyModel

  [BusinessEvents.AGGREGATE_UPDATE]: AggregateUpdatePayload

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
  | { type: BusinessEvents.RECENTLY_UPDATE; payload: RecentlyModel }
  | { type: BusinessEvents.AGGREGATE_UPDATE; payload: AggregateUpdatePayload }
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
