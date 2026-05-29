import { Pie, PieChart } from 'recharts'
import type { TrafficSourceResponse } from '~/api/analyze'
import type { ChartConfig } from '~/ui/data/chart'

import { useI18n } from '~/i18n'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '~/ui/data/chart'
import { Scroll } from '~/ui/primitives/scroll'

import { formatNumber } from '../utils/analyze'

type PaletteEntry = { light: string; dark: string }

const PALETTE: PaletteEntry[] = [
  { light: 'var(--color-primary)', dark: 'var(--color-primary)' },
  { light: '#0a0a0a', dark: '#fafafa' },
  { light: '#525252', dark: '#a3a3a3' },
  { light: '#a3a3a3', dark: '#525252' },
  { light: '#737373', dark: '#d4d4d4' },
  { light: '#171717', dark: '#e5e5e5' },
]

export function TrafficSourceChart(props: { data: TrafficSourceResponse }) {
  const { t } = useI18n()

  const chartData = props.data.categories.map((category, index) => {
    const key = `slice-${index}`
    return {
      key,
      name: key,
      label: category.name || t('analyze.distribution.unknown'),
      value: category.value,
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
    <div className="grid gap-3 p-4">
      {chartData.length ? (
        <ChartContainer
          className="aspect-square max-h-56 w-full"
          config={chartConfig}
        >
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent hideLabel nameKey="name" />}
            />
            <Pie
              data={chartData}
              dataKey="value"
              innerRadius={50}
              nameKey="name"
              outerRadius={80}
              strokeWidth={2}
            />
            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
          </PieChart>
        </ChartContainer>
      ) : null}
      {props.data.details.length ? (
        <div className="border-t border-neutral-100 pt-3 dark:border-neutral-900">
          <div className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t('analyze.traffic.detail')}
          </div>
          <Scroll viewportClassName="max-h-36" innerClassName="grid gap-2">
            {props.data.details.slice(0, 8).map((item) => (
              <div
                className="flex items-center justify-between gap-3 text-xs"
                key={item.source}
              >
                <span className="min-w-0 truncate font-mono text-neutral-600 dark:text-neutral-300">
                  {item.source || t('analyze.traffic.direct')}
                </span>
                <span className="tabular-nums text-neutral-400">
                  {formatNumber(item.count)}
                </span>
              </div>
            ))}
          </Scroll>
        </div>
      ) : null}
    </div>
  )
}
