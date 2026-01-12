import type { BaseCommentIndexModel } from './base'

export enum RecentlyRefTypes {
  Post = 'Post',
  Note = 'Note',
  Page = 'Page',
}

export type RecentlyRefType = {
  title: string
  url: string
}
export interface RecentlyModel extends BaseCommentIndexModel {
  content: string

  ref?: RecentlyRefType & { [key: string]: any }
  refId?: string
  refType?: RecentlyRefTypes

  up: number
  down: number

  modified?: string
}
