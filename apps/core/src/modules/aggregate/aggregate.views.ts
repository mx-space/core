import { z } from 'zod'

const AggregateDetailSchema = z.object({}).passthrough()

export const AggregateViews = {
  detail: AggregateDetailSchema,
} as const

export type AggregateView = keyof typeof AggregateViews
