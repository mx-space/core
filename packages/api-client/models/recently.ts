export enum RecentlyRefTypes {
  Post = 'post',
  Note = 'note',
  Page = 'page',
  Recently = 'recently',
}

export type RecentlyRefType = {
  title: string
  url: string
}

/**
 * 服务端 attachRef 注入：when `refType`/`refId` 指向 post/note/page/recently，
 * 列表/详情会附此扁形 summary；orphan ref（目标已删）则为 null。
 */
export interface RecentlyRefSummary {
  id: string
  type: RecentlyRefTypes
  title?: string
  slug?: string | null
  nid?: number
  url?: string
}

export enum RecentlyTypeEnum {
  Text = 'text',
  Book = 'book',
  Media = 'media',
  Music = 'music',
  Github = 'github',
  Link = 'link',
  Academic = 'academic',
  Code = 'code',
}

export interface BookMetadata {
  url: string
  title: string
  author: string
  cover?: string
  rating?: number
  isbn?: string
}

export interface MediaMetadata {
  url: string
  title: string
  originalTitle?: string
  cover?: string
  rating?: number
  description?: string
  genre?: string
}

export interface MusicMetadata {
  url: string
  title: string
  artist: string
  album?: string
  cover?: string
  source?: string
}

export interface GithubMetadata {
  url: string
  owner: string
  repo: string
  description?: string
  stars?: number
  language?: string
  languageColor?: string
}

export interface LinkMetadata {
  url: string
  title?: string
  description?: string
  image?: string
}

export interface AcademicMetadata {
  url: string
  title: string
  authors?: string[]
  arxivId?: string
}

export interface CodeMetadata {
  url: string
  title: string
  difficulty?: string
  tags?: string[]
  platform?: string
}

export type RecentlyMetadata =
  | BookMetadata
  | MediaMetadata
  | MusicMetadata
  | GithubMetadata
  | LinkMetadata
  | AcademicMetadata
  | CodeMetadata

export interface RecentlyModel {
  id: string
  createdAt: string
  modifiedAt: string | null

  content: string
  type: RecentlyTypeEnum
  metadata: RecentlyMetadata | null

  refType: RecentlyRefTypes
  refId: string | null
  ref?: RecentlyRefSummary | null

  up: number
  down: number

  commentsIndex: number
  allowComment: boolean
}
