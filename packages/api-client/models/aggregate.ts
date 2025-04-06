import type { CategoryModel } from './category'
import type { NoteModel } from './note'
import type { PageModel } from './page'
import type { PostModel } from './post'
import type { SayModel } from './say'
import type { SeoOptionModel } from './setting'
import type { UserModel } from './user'

export interface AggregateRoot {
  user: UserModel
  seo: SeoOptionModel
  url: Url
  categories: CategoryModel[]
  pageMeta: Pick<PageModel, 'title' | 'id' | 'slug' | 'order'>[] | null
  /**
   * @available 4.2.2
   */
  latestNoteId: { id: string; nid: number }
}

export interface AggregateRootWithTheme<Theme = unknown> extends AggregateRoot {
  theme?: Theme
}

export interface Url {
  wsUrl: string
  serverUrl: string
  webUrl: string
}

export interface AggregateTopNote
  extends Pick<NoteModel, 'id' | 'title' | 'created' | 'nid' | 'images'> {}

export interface AggregateTopPost
  extends Pick<
    PostModel,
    'id' | 'slug' | 'created' | 'title' | 'category' | 'images'
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
