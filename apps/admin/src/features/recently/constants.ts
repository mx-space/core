import { File, FileText, StickyNote } from 'lucide-react'
import type { TranslationKey } from '~/i18n/types'
import type { RecentlyRefTypes } from '~/models/recently'
import { adminQueryKeys } from '~/query/keys'

export const RECENTLY_PAGE_SIZE = 20

export const recentlyListQueryKey = adminQueryKeys.recently.list({
  size: RECENTLY_PAGE_SIZE,
})

export const recentlyQueryKey = adminQueryKeys.recently.root

export const URL_REGEX = /https?:\/\/\S+/gi
export const URL_TAIL_TRIM =
  /[)\].,;:!?'"`>}）。，、；：！？「」『』《》〉〕—…]+$/

export const refTypeIcons: Record<RecentlyRefTypes, typeof FileText> = {
  note: StickyNote,
  page: File,
  post: FileText,
  recently: StickyNote,
}

export const refTypeLabelKeys: Record<RecentlyRefTypes, TranslationKey> = {
  note: 'recently.refLabel.note',
  page: 'recently.refLabel.page',
  post: 'recently.refLabel.post',
  recently: 'recently.refLabel.recently',
}
