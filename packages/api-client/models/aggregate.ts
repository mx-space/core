import type { NoteModel } from './note'
import type { PostModel } from './post'
import type { SayModel } from './say'
import type { CommentOptionsModel, SeoOptionModel } from './setting'
import type { UserModel } from './user'

export interface AggregateAIConfig {
  enableSummary: boolean
}

export interface AggregateRoot {
  user: UserModel
  seo: SeoOptionModel
  url: Url
  commentOptions?: Pick<
    CommentOptionsModel,
    'disableComment' | 'allowGuestComment'
  >
  /**
   * @available 4.2.2
   */
  latestNoteId: { id: string; nid: number }
  /**
   * @available 9.2.0
   */
  ai?: AggregateAIConfig
}

export interface AggregateRootWithTheme<Theme = unknown> extends AggregateRoot {
  theme?: Theme
}

export interface AggregateSiteInfo {
  user: Pick<UserModel, 'id' | 'name' | 'socialIds'>
  seo: SeoOptionModel
  url: Pick<Url, 'webUrl'>
}

export interface Url {
  wsUrl: string
  serverUrl: string
  webUrl: string
}

export interface AggregateTopNote extends Pick<
  NoteModel,
  'id' | 'title' | 'created' | 'nid' | 'images' | 'mood' | 'weather'
> {}

export interface AggregateTopPost extends Pick<
  PostModel,
  'id' | 'slug' | 'created' | 'title' | 'category' | 'images' | 'summary'
> {}

export interface AggregateTop {
  notes: AggregateTopNote[]
  posts: AggregateTopPost[]
  says: SayModel[]
}

export enum TimelineType {
  Post,
  Note,
}

export interface TimelineData {
  notes?: Pick<
    NoteModel,
    | 'id'
    | 'nid'
    | 'title'
    | 'weather'
    | 'mood'
    | 'created'
    | 'modified'
    | 'bookmark'
  >[]

  posts?: (Pick<
    PostModel,
    'id' | 'title' | 'slug' | 'created' | 'modified' | 'category'
  > & { url: string })[]
}

export interface LatestPostItem extends Pick<
  PostModel,
  'id' | 'title' | 'slug' | 'created' | 'modified' | 'tags'
> {
  category: Pick<CategoryModel, 'name' | 'slug'> | null
}

export interface LatestNoteItem extends Pick<
  NoteModel,
  | 'id'
  | 'title'
  | 'nid'
  | 'created'
  | 'modified'
  | 'mood'
  | 'weather'
  | 'bookmark'
> {}

export interface LatestData {
  posts?: LatestPostItem[]
  notes?: LatestNoteItem[]
}

export type LatestCombinedItem =
  | (LatestPostItem & { type: 'post' })
  | (LatestNoteItem & { type: 'note' })

export interface AggregateStat {
  allComments: number
  categories: number
  comments: number
  linkApply: number
  links: number
  notes: number
  pages: number
  posts: number
  says: number
  recently: number
  unreadComments: number
  online: number
  todayMaxOnline: string
  todayOnlineTotal: string
  callTime: number
  uv: number
  todayIpAccessCount: number
}
