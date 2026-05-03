import type { Image } from './base'

export enum EnumPageType {
  'md' = 'md',
  'html' = 'html',
  'frame' = 'frame',
}

export interface PageModelMarkdown {
  id: string
  createdAt: string
  modifiedAt: string | null
  title: string
  slug: string
  subtitle?: string | null
  text: string
  contentFormat?: 'markdown'
  content?: undefined
  meta?: Record<string, any> | null
  images?: Image[]
  order?: number
  type?: EnumPageType
  options?: object
}

export interface PageModelLexical {
  id: string
  createdAt: string
  modifiedAt: string | null
  title: string
  slug: string
  subtitle?: string | null
  text?: string
  contentFormat: 'lexical'
  content: string
  meta?: Record<string, any> | null
  images?: Image[]
  order?: number
  type?: EnumPageType
  options?: object
}

export type PageModel = PageModelMarkdown | PageModelLexical
