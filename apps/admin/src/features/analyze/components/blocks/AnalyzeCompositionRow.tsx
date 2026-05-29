import { useQuery } from '@tanstack/react-query'
import { MonitorSmartphone, Route } from 'lucide-react'

import { getDeviceDistribution, getTrafficSource } from '~/api/analyze'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Panel } from '~/ui/primitives/panel'

import { hasDeviceDistribution } from '../../utils/analyze'
import { AnalyzeSkeleton, EmptyBlock, ErrorBlock } from '../AnalyzePrimitives'
import { DeviceDistributionChart } from '../DeviceDistributionChart'
import { TrafficSourceChart } from '../TrafficSourceChart'

export function AnalyzeCompositionRow(props: {
  window: { start: number; end: number }
}) {
  const { t } = useI18n()

  const trafficSourceQuery = useQuery({
    queryFn: () =>
      getTrafficSource({
        from: String(props.window.start),
        to: String(props.window.end),
      }),
    queryKey: adminQueryKeys.analyze.trafficSource({
      end: props.window.end,
      start: props.window.start,
    }),
  })
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

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            <Route aria-hidden="true" className="size-4" />
            {t('analyze.traffic.title')}
          </span>
        }
      >
        {trafficSourceQuery.isLoading ? (
          <AnalyzeSkeleton />
        ) : trafficSourceQuery.isError ? (
          <ErrorBlock
            label={t('analyze.traffic.error')}
            onRetry={() => void trafficSourceQuery.refetch()}
          />
        ) : trafficSourceQuery.data?.categories.length ? (
          <TrafficSourceChart data={trafficSourceQuery.data} />
        ) : (
          <EmptyBlock label={t('analyze.traffic.empty')} />
        )}
      </Panel>

      <Panel
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
        ) : hasDeviceDistribution(deviceDistributionQuery.data) ? (
          <DeviceDistributionChart data={deviceDistributionQuery.data} />
        ) : (
          <EmptyBlock label={t('analyze.device.empty')} />
        )}
      </Panel>
    </div>
  )
}
