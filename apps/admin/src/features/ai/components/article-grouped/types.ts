import type { ArticleInfo, PaginationInfo } from '~/api/ai'
import type { TranslationKey } from '~/i18n/types'
import type { HeaderAction } from '~/ui/layout/page-layout'
import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'

export interface ArticleGroup<TItem> {
  article: ArticleInfo
  items: TItem[]
}

export interface ItemAction<TItem> {
  id: string
  labelKey: TranslationKey
  icon?: LucideIcon
  destructive?: boolean
  run: (item: TItem) => Promise<unknown>
  confirm?: { messageKey: TranslationKey }
}

export interface GroupedPage<TItem> {
  data: ArticleGroup<TItem>[]
  pagination: PaginationInfo
}

export interface ItemsByRefResult<TItem> {
  article: { document: { title: string }; type: ArticleInfo['type'] } | null
  items: TItem[]
}

export interface EditDrawerBodyProps<TItem> {
  item: TItem
  onSubmit: (next: TItem) => Promise<void>
  onCancel: () => void
  submitting: boolean
}

export interface ArticleGroupedConfig<TItem> {
  scopeIdPrefix: string
  pageTitleKey: TranslationKey
  totalCountKey: TranslationKey
  itemCountKey: TranslationKey
  searchPlaceholderKey: TranslationKey
  emptyTitleKey: TranslationKey
  emptyDescriptionKey: TranslationKey
  detailEmptyTitleKey: TranslationKey
  detailEmptyDescriptionKey: TranslationKey
  detailSectionTitleKey: TranslationKey
  inlineEmptyKey: TranslationKey
  itemDeleteConfirmKey: TranslationKey
  editTitleKey: TranslationKey
  kindKey: TranslationKey

  groupedQueryKey: string
  getGroupedPage: (params: {
    page: number
    search?: string
    size: number
  }) => Promise<GroupedPage<TItem>>
  getItemsByRef: (refId: string) => Promise<ItemsByRefResult<TItem>>
  deleteItem: (id: string) => Promise<unknown>
  updateItem: (id: string, next: TItem) => Promise<unknown>

  generate: {
    labelKey: TranslationKey
    icon: LucideIcon
    promptForLang?: boolean
    runTask: (input: {
      refId: string
      lang?: string
    }) => Promise<{ created: boolean; taskId: string }>
    taskTypeForQueue: 'Summary' | 'Translation' | 'Insights'
  }

  pageActions?: (ctx: { invalidate: () => Promise<void> }) => HeaderAction[]

  extraItemActions?: (item: TItem) => ItemAction<TItem>[]

  getPreview: (item: TItem) => string
  getLang: (item: TItem) => string
  getCreatedAt: (item: TItem) => string
  getId: (item: TItem) => string

  EditDrawerBody: ComponentType<EditDrawerBodyProps<TItem>>
}
