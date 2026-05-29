import { FileText, StickyNote } from 'lucide-react'
import type { ArticleInfo } from '~/api/ai'
import type { TranslationKey } from '~/i18n/types'
import type { LucideIcon } from 'lucide-react'

export interface RefTypeMeta {
  icon: LucideIcon
  labelKey: TranslationKey
  editPath: ((id: string) => string) | null
}

const FALLBACK: RefTypeMeta = {
  icon: FileText,
  labelKey: 'ai.refType.post',
  editPath: null,
}

const META_BY_TYPE: Record<ArticleInfo['type'], RefTypeMeta> = {
  Post: {
    icon: FileText,
    labelKey: 'ai.refType.post',
    editPath: (id: string) => `/posts/edit?id=${id}`,
  },
  Note: {
    icon: StickyNote,
    labelKey: 'ai.refType.note',
    editPath: (id: string) => `/notes/edit?id=${id}`,
  },
  Page: {
    icon: FileText,
    labelKey: 'ai.refType.page',
    editPath: (id: string) => `/pages/edit?id=${id}`,
  },
  Recently: {
    icon: FileText,
    labelKey: 'ai.refType.recently',
    editPath: null,
  },
}

export function getRefTypeMeta(type: string | undefined | null): RefTypeMeta {
  if (!type) return FALLBACK
  if (type in META_BY_TYPE) {
    return META_BY_TYPE[type as ArticleInfo['type']]
  }
  const normalized = (type.charAt(0).toUpperCase() +
    type.slice(1).toLowerCase()) as ArticleInfo['type']
  return META_BY_TYPE[normalized] ?? FALLBACK
}
