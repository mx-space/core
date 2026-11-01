import { Plus, RefreshCw, Search, Sparkles } from 'lucide-react'

import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import { PageHeaderBar } from '~/ui/layout/page-header-bar'
import { Button } from '~/ui/primitives/button'
import { SegmentedControl } from '~/ui/primitives/segmented-control'
import { TextInput } from '~/ui/primitives/text-field'

import type { ComponentUsageReport } from '../utils/component-usage'

export const USAGE_FILTERS = ['all', 'used', 'draftOnly', 'unused'] as const
export type UsageFilter = (typeof USAGE_FILTERS)[number]

export function DynamicComponentsHeader(props: {
  counts: Record<UsageFilter, number>
  filter: UsageFilter
  onCleanup: () => void
  onCreate: () => void
  onFilterChange: (filter: UsageFilter) => void
  onRefresh: () => void
  onSearchChange: (value: string) => void
  refreshing: boolean
  report: ComponentUsageReport | undefined
  search: string
  total: number
  usageState: 'error' | 'loading' | 'ready'
}) {
  const { t } = useI18n()
  const report = props.report
  const files = report?.entries.reduce(
    (sum, entry) => sum + entry.versions.length,
    0,
  )
  const totalBytes = report?.entries.reduce(
    (sum, entry) => sum + entry.bytes,
    0,
  )

  const summary =
    props.usageState === 'loading'
      ? t('dynamicComponents.usage.loading')
      : props.usageState === 'error' || !report
        ? t('dynamicComponents.usage.failed')
        : t('dynamicComponents.usage.summary', {
            components: report.entries.length,
            files: files ?? 0,
            reclaimable: formatBytes(report.reclaimableBytes),
            total: formatBytes(totalBytes ?? 0),
          })

  return (
    <PageHeaderBar
      actions={
        <>
          <Button
            aria-label={t('dynamicComponents.refreshAria')}
            className="h-8 px-2"
            disabled={props.refreshing}
            onClick={props.onRefresh}
            type="button"
            variant="subtle"
          >
            <RefreshCw aria-hidden="true" className="size-3.5" />
          </Button>
          <Button
            className="h-8 px-2.5"
            disabled={!report}
            onClick={props.onCleanup}
            type="button"
            variant="secondary"
          >
            <Sparkles aria-hidden="true" className="size-3.5" />
            {t('dynamicComponents.cleanup.open', {
              size: formatBytes(report?.reclaimableBytes ?? 0),
            })}
          </Button>
          <Button className="h-8 px-2.5" onClick={props.onCreate} type="button">
            <Plus aria-hidden="true" className="size-3.5" />
            {t('dynamicComponents.add')}
          </Button>
        </>
      }
      count={props.total}
      filters={
        <>
          <SegmentedControl<UsageFilter>
            onValueChange={props.onFilterChange}
            options={USAGE_FILTERS.map((value) => ({
              label: (
                <span className="flex items-baseline gap-1">
                  {t(`dynamicComponents.usage.filter.${value}`)}
                  <span className="text-xs tabular-nums text-fg-subtle">
                    {props.counts[value]}
                  </span>
                </span>
              ),
              value,
            }))}
            value={props.filter}
          />
          <div className="relative w-48 shrink-0">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-fg-subtle"
            />
            <TextInput
              aria-label={t('dynamicComponents.searchPlaceholder')}
              controlClassName="h-8 pl-8"
              onChange={props.onSearchChange}
              placeholder={t('dynamicComponents.searchPlaceholder')}
              type="search"
              value={props.search}
            />
          </div>
        </>
      }
      summary={summary}
      title={t('dynamicComponents.title')}
    />
  )
}
