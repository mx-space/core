import type { EnrichmentMap } from './post'

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
  Link = 'link',
}

export interface EnrichmentImagePalette {
  dominant: string
  swatches?: string[]
}

export interface EnrichmentImage {
  url: string
  width?: number
  height?: number
  alt?: string
  blurhash?: string
  palette?: EnrichmentImagePalette
}

export interface EnrichmentAttribute {
  key: string
  value: string | number | boolean
  label?: string
  format?: 'number' | 'rating' | 'date' | 'percent' | 'text' | 'duration'
}

export interface EnrichmentResult {
  id?: string

  title: string
  description?: string
  thumbnailImage?: EnrichmentImage
  previewImage?: EnrichmentImage
  url: string
  category: string
  subtype?: string
  publishedAt?: string
  fetchedAt: string
  attributes?: EnrichmentAttribute[]
  color?: string
  links?: Array<{ rel: string; url: string; label?: string }>
  captureImage?: EnrichmentImage
}

/**
 * 创建/更新 shorthand 时的轻量元数据。仅 url 必需，
 * 服务端据此匹配 provider 并落地至 enrichment_cache。
 */
export interface RecentlyCreateMetadata {
  url?: string
  [key: string]: unknown
}

export interface RecentlyModel {
  id: string
  createdAt: string
  modifiedAt: string | null

  content: string
  type: RecentlyTypeEnum
  metadata: RecentlyCreateMetadata | null

  refType: RecentlyRefTypes
  refId: string | null
  ref?: RecentlyRefSummary | null

  up: number
  down: number

  commentsIndex: number
  allowComment: boolean

  enrichments?: EnrichmentMap
}
