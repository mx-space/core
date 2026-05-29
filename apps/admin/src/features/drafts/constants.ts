import { BookOpen, Code2, FileText } from 'lucide-react'
import type { TranslationKey } from '~/i18n/types'
import type { DraftRefType } from '~/models/draft'
import type { LucideIcon } from 'lucide-react'

import { DraftRefType as DraftRefTypeValue } from '~/models/draft'

export const draftsQueryKey = ['drafts'] as const

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
  { className: string; icon: LucideIcon; labelKey: TranslationKey }
> = {
  [DraftRefTypeValue.Post]: {
    className:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300',
    icon: Code2,
    labelKey: 'drafts.refType.post',
  },
  [DraftRefTypeValue.Note]: {
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
    icon: BookOpen,
    labelKey: 'drafts.refType.note',
  },
  [DraftRefTypeValue.Page]: {
    className:
      'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-300',
    icon: FileText,
    labelKey: 'drafts.refType.page',
  },
}
