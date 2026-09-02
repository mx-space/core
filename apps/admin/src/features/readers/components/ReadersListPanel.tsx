import { Heart } from 'lucide-react'

import type {
  ReaderMembershipStatusFilter,
  ReaderModel,
  ReaderRoleFilter,
  ReaderStats,
} from '~/api/readers'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { ContentListRefreshButton } from '~/features/_shared/components/content-list-toolbar'
import { useI18n } from '~/i18n'
import type { Pager } from '~/models/base'
import { FocusScope } from '~/ui/focus-scope'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { useListKeyboard } from '~/ui/list-actions'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { presentSponsorsImportModal } from './modals/SponsorsImportModal'
import { ReaderListRow } from './ReaderListRow'
import { ReadersListEmpty } from './ReadersListEmpty'
import { ReadersListSkeleton } from './ReadersListSkeleton'
import { ReadersPaginationFooter } from './ReadersPaginationFooter'
import { ReadersTabBar } from './ReadersTabBar'
import { ReadersToolbar } from './ReadersToolbar'

const HEADER_ICON_BUTTON_CLASS =
  'outline-hidden inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-[var(--color-primary-shallow)] dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100'

const FOCUS_SCOPE_ID = 'readers-list'

interface ReadersListPanelProps {
  readers: ReaderModel[]
  stats: ReaderStats | undefined
  pagination: Pager | undefined
  isLoading: boolean
  isFetching: boolean
  detailId: string | null
  onSelect: (reader: ReaderModel) => void
  search: string
  onSearchChange: (value: string) => void
  role: ReaderRoleFilter
  onRoleChange: (role: ReaderRoleFilter) => void
  membershipStatus: 'all' | ReaderMembershipStatusFilter
  onMembershipStatusChange: (
    value: 'all' | ReaderMembershipStatusFilter,
  ) => void
  page: number
  onPageChange: (page: number) => void
  onRefresh: () => void
}

export function ReadersListPanel(props: ReadersListPanelProps) {
  const { t } = useI18n()
  const { readers } = props

  useListKeyboard<ReaderModel>({
    actions: [
      {
        key: 'open',
        label: 'Open',
        shortcut: 'Enter',
        run: (targets) => {
          const target = targets[0]
          if (target) props.onSelect(target)
        },
      },
    ],
    getId: (reader) => reader.id,
    items: readers,
    onItemFocus: (id) => {
      const reader = readers.find((item) => item.id === id)
      if (reader) props.onSelect(reader)
    },
    resetOn: [props.search, props.role],
    scopeId: FOCUS_SCOPE_ID,
  })

  const hasSearch = props.search.trim().length > 0
  const showSkeleton = props.isLoading && readers.length === 0
  const showEmpty = !props.isLoading && readers.length === 0

  return (
    <FocusScope
      className="outline-hidden flex h-full min-h-0 flex-col"
      id={FOCUS_SCOPE_ID}
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <MobileHeaderAffordance />
          <h2 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold text-neutral-950 dark:text-neutral-50">
            <span className="truncate">{t('readers.title')}</span>
            <span className="text-xs font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
              {props.stats?.all ?? props.pagination?.total ?? 0}
            </span>
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            aria-label={t('readers.sponsors.import.button')}
            className={HEADER_ICON_BUTTON_CLASS}
            onClick={() => void presentSponsorsImportModal()}
            title={t('readers.sponsors.import.button')}
            type="button"
          >
            <Heart aria-hidden="true" className="size-3.5" />
          </button>
          <ContentListRefreshButton
            isFetching={props.isFetching}
            label={t('readers.refresh')}
            onRefresh={props.onRefresh}
          />
        </div>
      </div>

      <ReadersTabBar
        onRoleChange={props.onRoleChange}
        role={props.role}
        stats={props.stats}
      />

      <ReadersToolbar
        membershipStatus={props.membershipStatus}
        onMembershipStatusChange={props.onMembershipStatusChange}
        onSearchChange={props.onSearchChange}
        search={props.search}
      />

      <Scroll className="flex-1">
        {showSkeleton ? (
          <ReadersListSkeleton />
        ) : showEmpty ? (
          <ReadersListEmpty hasSearch={hasSearch} />
        ) : (
          readers.map((reader) => (
            <ReaderListRow
              key={reader.id}
              onSelect={() => props.onSelect(reader)}
              reader={reader}
              selected={props.detailId === reader.id}
            />
          ))
        )}
      </Scroll>

      {props.pagination ? (
        <ReadersPaginationFooter
          onPageChange={props.onPageChange}
          page={props.page}
          pagination={props.pagination}
        />
      ) : null}
    </FocusScope>
  )
}
