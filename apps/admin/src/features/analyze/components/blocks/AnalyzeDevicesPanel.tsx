import { useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import { Cpu, Monitor, MonitorSmartphone } from 'lucide-react'

import { getDeviceDistribution } from '~/api/analyze'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Panel } from '~/ui/primitives/panel'

import { hasDeviceDistribution } from '../../utils/analyze'
import { AnalyzeSkeleton, EmptyBlock, ErrorBlock } from '../AnalyzePrimitives'
import { BarList } from '../BarList'

function DistributionGroup(props: {
  icon: LucideIcon
  items: Array<{ name: string; value: number }>
  label: string
}) {
  const { t } = useI18n()
  const Icon = props.icon

  return (
    <div className="bg-surface-card p-4">
      <h3 className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium uppercase text-fg-muted">
        <Icon aria-hidden="true" className="size-3.5 text-fg-subtle" />
        {props.label}
      </h3>
      {props.items.length ? (
        <BarList
          items={props.items.slice(0, 6).map((item) => ({
            key: item.name || 'unknown',
            label: item.name || t('analyze.distribution.unknown'),
            value: item.value,
          }))}
        />
      ) : (
        <p className="text-sm text-fg-muted">{t('analyze.device.empty')}</p>
      )}
    </div>
  )
}

export function AnalyzeDevicesPanel(props: {
  window: { start: number; end: number }
}) {
  const { t } = useI18n()

  const deviceDistributionQuery = useQuery({
    queryFn: () =>
      getDeviceDistribution({
        from: String(props.window.start),
        to: String(props.window.end),
      }),
    queryKey: adminQueryKeys.analyze.deviceDistribution({
      end: props.window.end,
      start: props.window.start,
    }),
  })
  const data = deviceDistributionQuery.data

  return (
    <Panel
      description={t('analyze.device.description')}
      title={
        <span className="inline-flex items-center gap-2">
          <MonitorSmartphone aria-hidden="true" className="size-4" />
          {t('analyze.device.title')}
        </span>
      }
    >
      {deviceDistributionQuery.isLoading ? (
        <AnalyzeSkeleton />
      ) : deviceDistributionQuery.isError ? (
        <ErrorBlock
          label={t('analyze.device.error')}
          onRetry={() => void deviceDistributionQuery.refetch()}
        />
      ) : hasDeviceDistribution(data) ? (
        <div className="grid gap-px bg-border sm:grid-cols-3">
          <DistributionGroup
            icon={MonitorSmartphone}
            items={data.devices}
            label={t('analyze.device.device')}
          />
          <DistributionGroup
            icon={Monitor}
            items={data.browsers}
            label={t('analyze.device.browser')}
          />
          <DistributionGroup
            icon={Cpu}
            items={data.os}
            label={t('analyze.device.os')}
          />
        </div>
      ) : (
        <EmptyBlock label={t('analyze.device.empty')} />
      )}
    </Panel>
  )
}
