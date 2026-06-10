import { useI18n } from '~/i18n'
import { SegmentedControl } from '~/ui/primitives/segmented-control'
import { SelectField } from '~/ui/primitives/select'

import type {
  CacheFilterMode,
  CaptureSortField,
  SortOrder,
} from '../types/enrichment'

export function FilterSegment(props: {
  onChange: (mode: CacheFilterMode) => void
  value: CacheFilterMode
}) {
  const { t } = useI18n()
  return (
    <SegmentedControl<CacheFilterMode>
      onValueChange={props.onChange}
      options={[
        { label: t('enrichment.filter.all'), value: 'all' },
        { label: t('enrichment.filter.failed'), value: 'failed' },
      ]}
      value={props.value}
    />
  )
}

export function CaptureControls(props: {
  onOrderChange: (order: SortOrder) => void
  onSortChange: (sort: CaptureSortField) => void
  order: SortOrder
  sort: CaptureSortField
}) {
  const { t } = useI18n()
  return (
    <div className="grid grid-cols-2 gap-2">
      <SelectField
        aria-label={t('enrichment.capture.sortAria')}
        onValueChange={props.onSortChange}
        options={[
          {
            label: t('enrichment.capture.sort.lastAccessed'),
            value: 'last_accessed',
          },
          { label: t('enrichment.capture.sort.created'), value: 'created' },
          { label: t('enrichment.capture.sort.bytes'), value: 'bytes' },
        ]}
        value={props.sort}
      />
      <SelectField
        aria-label={t('enrichment.capture.orderAria')}
        onValueChange={props.onOrderChange}
        options={[
          { label: t('enrichment.capture.order.desc'), value: 'desc' },
          { label: t('enrichment.capture.order.asc'), value: 'asc' },
        ]}
        value={props.order}
      />
    </div>
  )
}
