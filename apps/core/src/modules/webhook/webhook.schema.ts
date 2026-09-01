import { z } from 'zod'

import { zStrictUrl } from '~/common/zod'
import { EventScope } from '~/constants/business-event.constant'

export const WebhookSchema = z.object({
  payloadUrl: zStrictUrl,
  events: z.array(z.string()),
  enabled: z.boolean(),
  secret: z.string(),
  scope: z.enum(EventScope),
})

export type WebhookDto = z.infer<typeof WebhookSchema>

export const PartialWebhookSchema = WebhookSchema.partial()

export type WebhookDtoPartial = z.infer<typeof PartialWebhookSchema>

// Type exports
export type WebhookInput = z.infer<typeof WebhookSchema>
export type PartialWebhookInput = z.infer<typeof PartialWebhookSchema>
