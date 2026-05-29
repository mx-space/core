import { Monitor, MonitorSmartphone, Route } from 'lucide-react'
import { Pie, PieChart } from 'recharts'
import type { DeviceDistributionResponse } from '~/api/analyze'
import type { ChartConfig } from '~/ui/data/chart'
import type { ReactNode } from 'react'

import { useI18n } from '~/i18n'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/ui/data/chart'

type PaletteEntry = { light: string; dark: string }

const PALETTE: PaletteEntry[] = [
  { light: 'var(--color-primary)', dark: 'var(--color-primary)' },
  { light: '#0a0a0a', dark: '#fafafa' },
  { light: '#525252', dark: '#a3a3a3' },
  { light: '#a3a3a3', dark: '#525252' },
  { light: '#737373', dark: '#d4d4d4' },
  { light: '#171717', dark: '#e5e5e5' },
]

type Item = { name: string; value: number }

function DeviceDonut(props: { icon: ReactNode; items: Item[]; label: string }) {
  const { t } = useI18n()
  if (!props.items.length) return null

  const chartData = props.items.map((item, index) => {
    const key = `slice-${index}`
    return {
      key,
      name: key,
      label: item.name || t('analyze.distribution.unknown'),
      value: item.value,
      fill: `var(--color-${key})`,
    }
  })

  const chartConfig: ChartConfig = Object.fromEntries(
    chartData.map((item, index) => [
      item.key,
      { label: item.label, theme: PALETTE[index % PALETTE.length] },
    ]),
  )

  return (
    <section>
      <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {props.icon}
        {props.label}
      </div>
      <ChartContainer
        className="aspect-square max-h-40 w-full"
        config={chartConfig}
      >
        <PieChart>
          <ChartTooltip
            content={<ChartTooltipContent hideLabel nameKey="name" />}
          />
          <Pie
            data={chartData}
            dataKey="value"
            innerRadius={36}
            nameKey="name"
            outerRadius={60}
            strokeWidth={2}
          />
        </PieChart>
      </ChartContainer>
    </section>
  )
}

export function DeviceDistributionChart(props: {
  data: DeviceDistributionResponse
}) {
  const { t } = useI18n()

  return (
    <div className="desktop:grid-cols-3 grid grid-cols-1 gap-4 p-4">
      <DeviceDonut
        icon={<MonitorSmartphone aria-hidden="true" className="size-3.5" />}
        items={props.data.devices}
        label={t('analyze.device.device')}
      />
      <DeviceDonut
        icon={<Monitor aria-hidden="true" className="size-3.5" />}
        items={props.data.browsers}
        label={t('analyze.device.browser')}
      />
      <DeviceDonut
        icon={<Route aria-hidden="true" className="size-3.5" />}
        items={props.data.os}
        label={t('analyze.device.os')}
      />
    </div>
  )
}
