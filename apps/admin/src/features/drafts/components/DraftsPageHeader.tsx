import { Plus, RefreshCw, Sparkles } from 'lucide-react'
import { Link } from 'react-router'

import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import type { DraftRefType, DraftStorageSummary } from '~/models/draft'
import { PageHeaderBar } from '~/ui/layout/page-header-bar'
import { DropdownMenu } from '~/ui/overlay/dropdown-menu'
import { Button } from '~/ui/primitives/button'
import { SegmentedControl } from '~/ui/primitives/segmented-control'
import { SelectField } from '~/ui/primitives/select'

import { filterOptionKeys } from '../constants'
import type { DraftRelationFilter, DraftSort } from '../utils/draft-filter'

const RELATIONS: Array<{
  labelKey: TranslationKey
  value: DraftRelationFilter
}> = [
  { labelKey: 'drafts.filter.all', value: 'all' },
  { labelKey: 'drafts.relationFilter.ahead', value: 'ahead' },
  { labelKey: 'drafts.relationFilter.fresh', value: 'fresh' },
  { labelKey: 'drafts.relationFilter.inSync', value: 'in_sync' },
]

export function DraftsPageHeader(props: {
  autoCleanup: boolean | undefined
  fetching: boolean
  onCleanup: () => void
  onRefresh: () => void
  onRelation: (next: DraftRelationFilter) => void
  onSort: (next: DraftSort) => void
  onType: (next: DraftRefType | 'all') => void
  relation: DraftRelationFilter
  sort: DraftSort
  storage: DraftStorageSummary | undefined
  total: number
  type: DraftRefType | 'all'
}) {
  const { t } = useI18n()
  const { storage } = props
  const counts = storage?.relations
  const countOf = (value: DraftRelationFilter) => {
    if (!counts) return null
    if (value === 'all') return counts.ahead + counts.fresh + counts.inSync
    if (value === 'in_sync') return counts.inSync
    return counts[value]
  }
  const totalBytes = storage
    ? storage.revisions.bytes + storage.crdt.bytes + storage.updates.bytes
    : 0

  return (
    <PageHeaderBar
      actions={
        <>
          <SelectField<DraftSort>
            aria-label={t('drafts.sort.label')}
            className="h-8 w-auto text-xs"
            onValueChange={props.onSort}
            options={[
              { label: t('drafts.sort.updated'), value: 'updated' },
              { label: t('drafts.sort.size'), value: 'size' },
            ]}
            popupClassName="w-auto min-w-[var(--anchor-width)] text-xs"
            value={props.sort}
          />
          <Button
            aria-label={t('common.refresh')}
            className="h-8 px-2"
            disabled={props.fetching}
            onClick={props.onRefresh}
            type="button"
            variant="subtle"
          >
            <RefreshCw
              aria-hidden="true"
              className={props.fetching ? 'size-3.5 animate-spin' : 'size-3.5'}
            />
          </Button>
          <Button
            className="h-8 px-2.5"
            onClick={props.onCleanup}
            type="button"
            variant="secondary"
          >
            <Sparkles aria-hidden="true" className="size-3.5" />
            {t('drafts.cleanup.openWithSize', {
              size: formatBytes(storage?.reclaimableBytes ?? 0),
            })}
          </Button>
          <DropdownMenu>
            <DropdownMenu.Trigger
              aria-label={t('drafts.newPost')}
              className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-accent px-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:ring-[3px] focus-visible:ring-accent/15"
              type="button"
            >
              <Plus aria-hidden="true" className="size-3.5" />
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
        </>
      }
      count={props.total}
      filters={
        <>
          <SegmentedControl<DraftRefType | 'all'>
            onValueChange={props.onType}
            options={filterOptionKeys.map((option) => ({
              label: t(option.labelKey),
              value: option.value,
            }))}
            value={props.type}
          />
          <SegmentedControl<DraftRelationFilter>
            onValueChange={props.onRelation}
            options={RELATIONS.map((option) => ({
              label: (
                <span className="flex items-baseline gap-1">
                  {t(option.labelKey)}
                  <span className="text-xs tabular-nums text-fg-subtle">
                    {countOf(option.value) ?? ''}
                  </span>
                </span>
              ),
              value: option.value,
            }))}
            value={props.relation}
          />
        </>
      }
      summary={
        <span className="flex min-w-0 items-center gap-3">
          <span className="truncate">
            {storage
              ? t('drafts.header.summary', {
                  crdt: formatBytes(storage.crdt.bytes),
                  revisions: formatBytes(storage.revisions.bytes),
                  total: formatBytes(totalBytes),
                  updates: formatBytes(storage.updates.bytes),
                })
              : '—'}
          </span>
          <Link
            className="shrink-0 underline-offset-2 hover:text-fg hover:underline"
            to="/setting/storage"
          >
            {props.autoCleanup
              ? t('drafts.autoCleanup.on')
              : t('drafts.autoCleanup.off')}
          </Link>
        </span>
      }
      title={t('drafts.title')}
    />
  )
}
