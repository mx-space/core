import { BaseModel } from './base'

export enum RecentlyRefTypes {
  Post = 'Post',
  Note = 'Note',
  Page = 'Page',
}

export type RecentlyRefType = {
  title: string
  url: string
}
export interface RecentlyModel extends BaseModel {
  content: string

  ref?: RecentlyRefType & { [key: string]: any }
  refId?: string
  refType?: RecentlyRefTypes
  /**
   * @deprecated
   */
  project?: string
  /**
   * @deprecated
   */
  language?: string
}
