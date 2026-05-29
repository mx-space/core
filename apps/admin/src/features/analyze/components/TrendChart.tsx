import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from '~/ui/data/chart'
import type { TrendPoint } from '../types/analyze'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '~/ui/data/chart'

const chartConfig = {
  pv: {
    label: 'PV',
    theme: { light: '#0a0a0a', dark: '#fafafa' },
  },
  ip: {
    label: 'IP',
    color: 'var(--color-primary)',
  },
} satisfies ChartConfig

export function TrendChart(props: { data: TrendPoint[] }) {
  return (
    <div className="p-4">
      <ChartContainer className="h-64 w-full" config={chartConfig}>
        <AreaChart
          data={props.data}
          margin={{ top: 8, right: 12, left: 12, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            tickLine={false}
            tickMargin={8}
          />
          <YAxis hide />
          <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
          <Area
            dataKey="pv"
            fill="var(--color-pv)"
            fillOpacity={0.15}
            stroke="var(--color-pv)"
            strokeWidth={2}
            type="monotone"
          />
          <Area
            dataKey="ip"
            fill="var(--color-ip)"
            fillOpacity={0.18}
            stroke="var(--color-ip)"
            strokeWidth={2}
            type="monotone"
          />
          <ChartLegend content={<ChartLegendContent />} />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
