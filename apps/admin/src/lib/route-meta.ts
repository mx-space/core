import type { TranslationKey } from '~/i18n/types'
import type { LucideIcon } from 'lucide-react'

export interface RouteMetadata {
  titleKey?: TranslationKey
  descriptionKey?: TranslationKey
  icon?: LucideIcon
  order?: number
  matchPaths?: string[]
  hidden?: boolean
}

export interface SectionMeta {
  titleKey: TranslationKey
  order: number
}

export function defineMetadata<T extends RouteMetadata>(meta: T): T {
  return meta
}
