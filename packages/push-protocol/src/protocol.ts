import { z } from 'zod'

export const PUSH_PROTOCOL_VERSION = 1 as const
export const COMMENT_CREATED_EVENT = 'dev.mx-space.comment.created.v1' as const

export const PushResourceDataSchema = z
  .object({
    resource_id: z.string().min(1).max(128),
    resource_type: z.literal('comment'),
  })
  .strict()

export const CommentCreatedEventSchema = z
  .object({
    specversion: z.literal('1.0'),
    id: z.string().min(1).max(256),
    source: z.string().startsWith('urn:mx-core:instance:'),
    type: z.literal(COMMENT_CREATED_EVENT),
    subject: z.string().regex(/^comment\/[\w-]{1,128}$/),
    time: z.iso.datetime({ offset: true }),
    datacontenttype: z.literal('application/json'),
    data: PushResourceDataSchema,
  })
  .strict()

export const PushEventSchema = z.discriminatedUnion('type', [
  CommentCreatedEventSchema,
])

export type PushEvent = z.infer<typeof PushEventSchema>
export type CommentCreatedEvent = z.infer<typeof CommentCreatedEventSchema>

export const RegisterInstallationSchema = z
  .object({
    app_id: z.string().min(1).max(64),
    apns_environment: z.enum(['development', 'production']),
    apns_token: z.string().regex(/^[\da-f]{64,}$/i),
  })
  .strict()

export const UpdateInstallationTokenSchema = RegisterInstallationSchema.pick({
  apns_environment: true,
  apns_token: true,
})

export const ClaimSourceActivationSchema = z
  .object({
    ticket: z.string().min(32).max(256),
    source_origin: z.url().max(2048),
    source_label: z.string().trim().min(1).max(128).optional(),
  })
  .strict()

export const ActivatePushSchema = z
  .object({
    relay_url: z.url().max(2048),
    activation_ticket: z.string().min(32).max(256),
  })
  .strict()

export const PushActivationResponseSchema = z.object({
  enabled: z.literal(true),
  relay_url: z.url(),
  binding_id: z.string().min(1),
})

export const PushStatusResponseSchema = z.object({
  configured: z.boolean(),
  enabled: z.boolean(),
  relay_url: z.url().nullable(),
})

export const RelayInstallationResponseSchema = z.object({
  installation_id: z.string().min(1),
  installation_secret: z.string().min(32),
})

export const RelayActivationTicketResponseSchema = z.object({
  ticket: z.string().min(32),
  expires_at: z.iso.datetime({ offset: true }),
})

export const RelayClaimResponseSchema = z.object({
  source_id: z.string().min(1),
  source_secret: z.string().min(32).optional(),
  binding_id: z.string().min(1),
  installation_id: z.string().min(1),
  event_endpoint: z.url(),
})

export const RelayAcceptedResponseSchema = z.object({
  accepted: z.literal(true),
  event_id: z.string().min(1),
  deliveries: z.number().int().nonnegative(),
})

export const installationAuthorization = (id: string, secret: string) =>
  `Installation ${id}.${secret}`

export const sourceAuthorization = (id: string, secret: string) =>
  `Source ${id}.${secret}`
