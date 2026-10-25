import { Plus, RefreshCw } from 'lucide-react'
import { Link } from 'react-router'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { DropdownMenu } from '~/ui/overlay/dropdown-menu'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

export function DraftListHeader(props: {
  fetching: boolean
  onRefresh: () => void
  total: number
}) {
  const { t } = useI18n()
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
        APP_SHELL_HEADER_HEIGHT_CLASS,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <MobileHeaderAffordance />
        <h2 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold text-neutral-950 dark:text-neutral-50">
          <span className="truncate">{t('drafts.title')}</span>
          <span className="text-xs font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
            {props.total}
          </span>
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <DropdownMenu>
          <DropdownMenu.Trigger
            aria-label={t('drafts.newPost')}
            className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg focus-visible:ring-[3px] focus-visible:ring-accent/15 data-[popup-open]:bg-surface-inset"
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            {t('common.add')}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item render={<Link to="/posts/edit" />}>
              {t('drafts.newPost')}
            </DropdownMenu.Item>
            <DropdownMenu.Item render={<Link to="/notes/edit" />}>
              {t('drafts.newNote')}
            </DropdownMenu.Item>
            <DropdownMenu.Item render={<Link to="/pages/edit" />}>
              {t('drafts.newPage')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
        <Button
          aria-label={t('common.refresh')}
          disabled={props.fetching}
          iconOnly
          onClick={props.onRefresh}
          type="button"
          variant="subtle"
        >
          <RefreshCw
            aria-hidden="true"
            className={cn('size-4', props.fetching && 'animate-spin')}
          />
        </Button>
      </div>
    </div>
  )
}
