import type { Image, Pager } from './base'

export enum EnumPageType {
  md = 'md',
  html = 'html',
  frame = 'frame',
}
export interface PageModel {
  createdAt: string
  modifiedAt: string | null
  id: string
  /** Slug */
  slug: string

  /** Title */
  title: string

  /** SubTitle */
  subtitle?: string

  /** Order */
  order?: number

  /** Text */
  text: string

  contentFormat?: 'markdown' | 'lexical'
  content?: string
  images?: Image[] | null
  meta?: Record<string, unknown> | null

  /** Type (MD | html | frame) */
  type?: EnumPageType

  /** Other Options */
  options?: object
}

export interface PageResponse {
  data: PageModel[]
  pagination: Pager
}
