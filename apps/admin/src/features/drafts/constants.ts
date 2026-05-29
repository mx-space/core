import { BookOpen, Code2, FileText } from 'lucide-react'
import type { TranslationKey } from '~/i18n/types'
import type { DraftRefType } from '~/models/draft'
import type { LucideIcon } from 'lucide-react'
import type { BadgeTone } from '~/ui/primitives/badge'

import { DraftRefType as DraftRefTypeValue } from '~/models/draft'
import { adminQueryKeys } from '~/query/keys'

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
