import { z } from 'zod'

const rate = z.number().finite().nonnegative()
const base = z.object({
  name: z.string(),
  unit: z.enum(['millionTokens', 'image', 'second']),
})
export const ModelPricingUnitSchema = z.discriminatedUnion('strategy', [
  base.extend({
    strategy: z.literal('fixed'),
    rate,
    originalRate: rate.optional(),
  }),
  base.extend({
    strategy: z.literal('tiered'),
    tiers: z
      .array(
        z.object({
          rate,
          originalRate: rate.optional(),
          upTo: z.union([z.number().positive(), z.literal('infinity')]),
        }),
      )
      .min(1),
  }),
  base.extend({
    strategy: z.literal('lookup'),
    lookup: z.object({
      pricingParams: z.array(z.string()),
      prices: z.record(z.string(), rate),
      originalPrices: z.record(z.string(), rate).optional(),
    }),
  }),
])
export type ModelPricingUnit = z.infer<typeof ModelPricingUnitSchema>

export interface ModelPricing {
  completion?: string
  image?: string
  prompt?: string
  request?: string
  unit: 'character' | 'token'
  currency?: 'USD' | 'CNY'
  units?: ModelPricingUnit[]
}

export const CloudModelPricingSchema = z.object({
  currency: z.enum(['USD', 'CNY']).optional(),
  units: z.array(ModelPricingUnitSchema).min(1),
})
