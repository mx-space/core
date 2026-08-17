import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const RelayOriginSchema = z
  .url()
  .max(2048)
  .superRefine((value, context) => {
    const url = new URL(value)
    const isLocal =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '::1' ||
      url.hostname.endsWith('.local')
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
      context.addIssue({
        code: 'custom',
        message: 'Relay URL must use HTTPS outside a local development host.',
      })
    }
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Relay URL must be an origin without credentials, path, query, or fragment.',
      })
    }
  })

export const PushActivationRequestSchema = z
  .object({
    relayUrl: RelayOriginSchema,
    activationTicket: z.string().min(32).max(256),
  })
  .strict()

export const PushActivationResponseSchema = z.object({
  enabled: z.literal(true),
  relayUrl: z.url(),
  bindingId: z.string().min(1),
})

export class PushActivationRequestDto extends createZodDto(
  PushActivationRequestSchema,
) {}
