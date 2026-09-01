import { z } from 'zod'

import { SubscribeTypeToBitMap } from './subscribe.constant'

const subscribeTypeKeys = Object.keys(SubscribeTypeToBitMap)

export const SubscribeSchema = z.object({
  email: z.string().email(),
  types: z.array(z.enum(subscribeTypeKeys as [string, ...string[]])),
})

export type SubscribeDto = z.infer<typeof SubscribeSchema>

export const CancelSubscribeSchema = z.object({
  email: z.string().email(),
  cancelToken: z.string(),
})

export type CancelSubscribeDto = z.infer<typeof CancelSubscribeSchema>

export const BatchUnsubscribeSchema = z
  .object({
    emails: z.array(z.email()).optional(),
    all: z.boolean().optional(),
  })
  .refine(
    (data) => data.all === true || (data.emails && data.emails.length > 0),
    {
      message: 'Either provide an emails array or set all to true',
    },
  )

export type BatchUnsubscribeDto = z.infer<typeof BatchUnsubscribeSchema>

// Type exports
export type SubscribeInput = z.infer<typeof SubscribeSchema>
export type CancelSubscribeInput = z.infer<typeof CancelSubscribeSchema>
export type BatchUnsubscribeInput = z.infer<typeof BatchUnsubscribeSchema>
