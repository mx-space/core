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

/**
 * Batch unsubscribe schema
 */
export const BatchUnsubscribeSchema = z
  .object({
    emails: z.array(z.email()).optional(),
    all: z.boolean().optional(),
  })
  .refine(
    (data) => data.all === true || (data.emails && data.emails.length > 0),
    {
      message: '必须提供 emails 数组或设置 all 为 true',
    },
  )

export class BatchUnsubscribeDto extends createZodDto(BatchUnsubscribeSchema) {}

// Type exports
export type SubscribeInput = z.infer<typeof SubscribeSchema>
export type CancelSubscribeInput = z.infer<typeof CancelSubscribeSchema>
export type BatchUnsubscribeInput = z.infer<typeof BatchUnsubscribeSchema>
