import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { SubscribeTypeToBitMap } from './subscribe.constant'

const subscribeTypeKeys = Object.keys(SubscribeTypeToBitMap)

/**
 * Subscribe schema
 */
export const SubscribeSchema = z.object({
  email: z.string().email(),
  types: z.array(z.enum(subscribeTypeKeys as [string, ...string[]])),
})

export class SubscribeDto extends createZodDto(SubscribeSchema) {}

/**
 * Cancel subscribe schema
 */
export const CancelSubscribeSchema = z.object({
  email: z.string().email(),
  cancelToken: z.string(),
})

export class CancelSubscribeDto extends createZodDto(CancelSubscribeSchema) {}

// Type exports
export type SubscribeInput = z.infer<typeof SubscribeSchema>
export type CancelSubscribeInput = z.infer<typeof CancelSubscribeSchema>
