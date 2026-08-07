import { z } from 'zod'

const MetricPointSchema = z.object({
  key: z.enum(['ip', 'pv']),
  value: z.number().int(),
})

const AnalyzeAggregateSchema = z.object({
  months: z.array(MetricPointSchema.extend({ date: z.string() })),
  paths: z.array(z.object({ count: z.number().int(), path: z.string() })),
  today: z.array(MetricPointSchema.extend({ hour: z.string() })),
  todayIps: z.array(z.string()),
  total: z.object({ callTime: z.number().int(), uv: z.number().int() }),
  weeks: z.array(MetricPointSchema.extend({ day: z.string() })),
})

export const AnalyzeViews = {
  aggregate: AnalyzeAggregateSchema,
} as const
