import { zStrictUrl } from '~/common/zod'
import { EventScope } from '~/constants/business-event.constant'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * Webhook schema for API validation
 */
export const WebhookSchema = z.object({
  payloadUrl: zStrictUrl,
  events: z.array(z.string()),
  enabled: z.boolean(),
  secret: z.string(),
  scope: z.enum(EventScope),
})

export class WebhookDto extends createZodDto(WebhookSchema) {}

/**
 * Partial webhook schema for PATCH operations
 */
export const PartialWebhookSchema = WebhookSchema.partial()

export class WebhookDtoPartial extends createZodDto(PartialWebhookSchema) {}

// Type exports
export type WebhookInput = z.infer<typeof WebhookSchema>
export type PartialWebhookInput = z.infer<typeof PartialWebhookSchema>
