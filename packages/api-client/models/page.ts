import type { TextBaseModel } from './base'

export enum EnumPageType {
  'md' = 'md',
  'html' = 'html',
  'frame' = 'frame',
}
export interface PageModel extends TextBaseModel {
  created: string

  slug: string

  subtitle?: string

  order?: number

  type?: EnumPageType

  options?: object
}
