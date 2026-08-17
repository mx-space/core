import { z } from 'zod'

export const PUSH_PROTOCOL_VERSION = 1 as const
export const COMMENT_CREATED_EVENT = 'dev.mx-space.comment.created.v1' as const
export const CONTENT_PUBLISHED_EVENT =
  'dev.mx-space.content.published.v1' as const
export const COMMENT_REPLIED_EVENT = 'dev.mx-space.comment.replied.v1' as const

const resourceId = z.string().min(1).max(128)
const publicTitle = z.string().trim().min(1).max(160)
const publicSummary = z.string().trim().min(1).max(360)
const internalTargetPath = z
  .string()
  .min(2)
  .max(512)
  .refine(
    (value) =>
      value.startsWith('/') &&
      !value.startsWith('//') &&
      !value.includes('\\') &&
      !value.includes('?') &&
      !value.includes('#') &&
      !value.split('/').some((segment) => segment === '.' || segment === '..'),
    'target_path must be a safe internal absolute path',
  )
const httpsUrl = z
  .url()
  .max(2048)
  .refine((value) => new URL(value).protocol === 'https:', 'HTTPS URL required')

export const PushResourceDataSchema = z
  .object({
    resource_id: resourceId,
    resource_type: z.literal('comment'),
  })
  .strict()

export const ContentPublishedDataSchema = z
  .object({
    resource_id: resourceId,
    resource_type: z.enum(['post', 'note', 'recently']),
    display_title: publicTitle,
    summary: publicSummary,
    target_path: internalTargetPath,
  })
  .strict()

export const CommentRepliedDataSchema = z
  .object({
    resource_id: resourceId,
    resource_type: z.literal('comment'),
    recipient_reader_id: resourceId,
    sender_id: resourceId,
    sender_name: z.string().trim().min(1).max(80),
    sender_avatar_url: httpsUrl.optional(),
    target_title: publicTitle,
    target_path: internalTargetPath,
  })
  .strict()

const cloudEventEnvelope = {
  specversion: z.literal('1.0'),
  id: z.string().min(1).max(256),
  source: z.string().startsWith('urn:mx-core:instance:'),
  time: z.iso.datetime({ offset: true }),
  datacontenttype: z.literal('application/json'),
}

const subjectMatchesResource = (
  ctx: z.core.ParsePayload<{
    subject: string
    data: { resource_id: string; resource_type: string }
  }>,
) => {
  const expected = `${ctx.value.data.resource_type}/${ctx.value.data.resource_id}`
  if (ctx.value.subject === expected) return
  ctx.issues.push({
    code: 'custom',
    input: ctx.value.subject,
    path: ['subject'],
    message: `subject must equal ${expected}`,
  })
}

export const CommentCreatedEventSchema = z
  .object({
    ...cloudEventEnvelope,
    type: z.literal(COMMENT_CREATED_EVENT),
    subject: z.string().regex(/^comment\/[\w-]{1,128}$/),
    data: PushResourceDataSchema,
  })
  .strict()

export const ContentPublishedEventSchema = z
  .object({
    ...cloudEventEnvelope,
    type: z.literal(CONTENT_PUBLISHED_EVENT),
    subject: z.string().regex(/^(post|note|recently)\/[\w-]{1,128}$/),
    data: ContentPublishedDataSchema,
  })
  .strict()
  .check(subjectMatchesResource)

export const CommentRepliedEventSchema = z
  .object({
    ...cloudEventEnvelope,
    type: z.literal(COMMENT_REPLIED_EVENT),
    subject: z.string().regex(/^comment\/[\w-]{1,128}$/),
    data: CommentRepliedDataSchema,
  })
  .strict()
  .check(subjectMatchesResource)

export const PushEventSchema = z.discriminatedUnion('type', [
  CommentCreatedEventSchema,
  ContentPublishedEventSchema,
  CommentRepliedEventSchema,
])

export type PushEvent = z.infer<typeof PushEventSchema>
export type CommentCreatedEvent = z.infer<typeof CommentCreatedEventSchema>
export type ContentPublishedEvent = z.infer<typeof ContentPublishedEventSchema>
export type CommentRepliedEvent = z.infer<typeof CommentRepliedEventSchema>

export const PushPreferencesSchema = z
  .object({
    content_post: z.boolean(),
    content_note: z.boolean(),
    content_recently: z.boolean(),
    comment_replied: z.boolean(),
  })
  .strict()

export type PushPreferences = z.infer<typeof PushPreferencesSchema>

export const DEFAULT_PUSH_PREFERENCES = Object.freeze({
  content_post: true,
  content_note: true,
  content_recently: true,
  comment_replied: true,
} as const satisfies Readonly<PushPreferences>)

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
    reader_id: resourceId.optional(),
    preferences: PushPreferencesSchema.optional(),
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
