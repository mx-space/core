import type { LucideIcon } from 'lucide-react'
import { BookOpen, Code2, FileText } from 'lucide-react'

import type { TranslationKey } from '~/i18n/types'
import type { DraftRefType, DraftRelation } from '~/models/draft'
import { DraftRefType as DraftRefTypeValue } from '~/models/draft'
import { adminQueryKeys } from '~/query/keys'
import type { BadgeTone } from '~/ui/primitives/badge'

export const draftsQueryKey = adminQueryKeys.drafts.root

export const filterOptionKeys: Array<{
  labelKey: TranslationKey
  value: DraftRefType | 'all'
}> = [
  { labelKey: 'drafts.filter.all', value: 'all' },
  { labelKey: 'drafts.refType.post', value: DraftRefTypeValue.Post },
  { labelKey: 'drafts.refType.note', value: DraftRefTypeValue.Note },
  { labelKey: 'drafts.refType.page', value: DraftRefTypeValue.Page },
]

export const refTypeMeta: Record<
  DraftRefType,
  { icon: LucideIcon; labelKey: TranslationKey; tone: BadgeTone }
> = {
  [DraftRefTypeValue.Post]: {
    icon: Code2,
    labelKey: 'drafts.refType.post',
    tone: 'info',
  },
  [DraftRefTypeValue.Note]: {
    icon: BookOpen,
    labelKey: 'drafts.refType.note',
    tone: 'success',
  },
  [DraftRefTypeValue.Page]: {
    icon: FileText,
    labelKey: 'drafts.refType.page',
    tone: 'warning',
  },
}

export const relationMeta: Record<
  DraftRelation,
  { className: string; labelKey: TranslationKey }
> = {
  ahead: {
    className:
      'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
    labelKey: 'drafts.relation.ahead',
  },
  fresh: {
    className: 'bg-surface-inset text-fg-muted',
    labelKey: 'drafts.relation.fresh',
  },
  in_sync: {
    className:
      'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    labelKey: 'drafts.relation.inSync',
  },
}

export const relationFilterKeys: Array<{
  labelKey: TranslationKey
  value: DraftRelation | 'all'
}> = [
  { labelKey: 'drafts.filter.all', value: 'all' },
  { labelKey: 'drafts.relation.inSync', value: 'in_sync' },
  { labelKey: 'drafts.relation.ahead', value: 'ahead' },
  { labelKey: 'drafts.relation.fresh', value: 'fresh' },
]
