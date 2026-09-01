import { z } from 'zod'

import { CollectionRefTypes } from '~/constants/db.constant'
import { BasicPagerSchema } from '~/shared/dto/pager.dto'
import { normalizeRefType } from '~/utils/database.util'

import { CommentAnchorMode } from './comment.enum'

const BlockCommentAnchorSchema = z.object({
  mode: z.literal(CommentAnchorMode.Block),
  blockId: z.string().trim().min(1).max(128),
  blockType: z.string().trim().min(1).max(64).optional(),
  blockFingerprint: z.string().trim().min(1).max(64).optional(),
  snapshotText: z.string().max(20000).optional(),
  lang: z.string().trim().min(1).max(10).nullish(),
})

const RangeCommentAnchorSchema = z
  .object({
    mode: z.literal(CommentAnchorMode.Range),
    blockId: z.string().trim().min(1).max(128),
    blockType: z.string().trim().min(1).max(64).optional(),
    blockFingerprint: z.string().trim().min(1).max(64).optional(),
    snapshotText: z.string().max(20000).optional(),
    lang: z.string().trim().min(1).max(10).nullish(),
    quote: z.string().min(1).max(1000),
    prefix: z.string().max(300).default(''),
    suffix: z.string().max(300).default(''),
    startOffset: z.number().int().min(0),
    endOffset: z.number().int().min(0),
  })
  .refine((data) => data.endOffset >= data.startOffset, {
    message: 'endOffset must be greater than or equal to startOffset',
    path: ['endOffset'],
  })

export const CommentAnchorSchema = z.discriminatedUnion('mode', [
  BlockCommentAnchorSchema,
  RangeCommentAnchorSchema,
])

/**
 * Comment schema for API validation
 */
export const CommentSchema = z.object({
  author: z
    .string()
    .min(1)
    .max(20, { message: 'Nickname must not exceed 20 characters' }),
  text: z
    .string()
    .min(1)
    .max(500, { message: 'Comment must not exceed 500 characters' }),
  mail: z
    .string()
    .email({ message: 'Please provide a valid email address' })
    .max(50, { message: 'Email address must not exceed 50 characters' }),
  url: z
    .string()
    .url({ message: 'Please provide a valid URL' })
    .max(50, { message: 'URL must not exceed 50 characters' })
    .optional(),
  isWhispers: z.boolean().optional(),
  avatar: z
    .string()
    .url({ message: 'Avatar must be a valid HTTPS URL' })
    .refine((val) => val.startsWith('https://'), {
      message: 'Avatar must be a valid HTTPS URL',
    })
    .optional(),
  anchor: CommentAnchorSchema.optional(),
})

export const AnonymousCommentSchema = CommentSchema
export const AnonymousReplyCommentSchema = CommentSchema.omit({ anchor: true })

export const ReaderCommentSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(500, { message: 'Comment must not exceed 500 characters' }),
  isWhispers: z.boolean().optional(),
  anchor: CommentAnchorSchema.optional(),
})

export const ReaderReplyCommentSchema = ReaderCommentSchema.omit({
  anchor: true,
})

export type CommentDto = z.infer<typeof AnonymousCommentSchema>
export type ReplyCommentDto = z.infer<typeof AnonymousReplyCommentSchema>
export type ReaderCommentDto = z.infer<typeof ReaderCommentSchema>
export type ReaderReplyCommentDto = z.infer<typeof ReaderReplyCommentSchema>

/**
 * Edit comment schema
 */
export const EditCommentSchema = z.object({
  text: z.string().min(1),
})

export type EditCommentDto = z.infer<typeof EditCommentSchema>

/**
 * Required guest reader comment schema
 */
export const RequiredGuestReaderCommentSchema = CommentSchema.extend({
  author: z
    .string()
    .min(1)
    .max(20, { message: 'Nickname must not exceed 20 characters' }),
  mail: z
    .string()
    .email({ message: 'Please provide a valid email address' })
    .max(50, { message: 'Email address must not exceed 50 characters' }),
})

export type RequiredGuestReaderCommentDto = z.infer<
  typeof RequiredGuestReaderCommentSchema
>

/**
 * Text only schema
 */
export const TextOnlySchema = z.object({
  text: z.string().min(1),
  anchor: CommentAnchorSchema.optional(),
})

export type TextOnlyDto = z.infer<typeof TextOnlySchema>

/**
 * Comment ref types schema
 */
export const CommentRefTypesSchema = z.object({
  ref: z
    .preprocess((val) => {
      if (!val) return undefined
      return normalizeRefType(val as any)
    }, z.enum(CollectionRefTypes))
    .optional(),
})

export type CommentRefTypesDto = z.infer<typeof CommentRefTypesSchema>

/**
 * Query schema for `GET /comments/ref/:id` list endpoint.
 *
 * - `sort`:
 *   - `pinned` (default, legacy): `pin` desc, then `created` desc
 *   - `newest`: `created` desc
 *   - `oldest`: `created` asc
 * - `around`: comment id; when set, the server computes the page that
 *   contains that comment under the active sort and returns it; the
 *   requested `page` is ignored.
 */
export const CommentListQuerySchema = z.object({
  sort: z.enum(['pinned', 'newest', 'oldest']).default('pinned'),
  around: z
    .string()
    .trim()
    .regex(/^[\da-f]{24}$/i, { message: 'around must be a valid id' })
    .optional(),
})

export type CommentListQueryDto = z.infer<typeof CommentListQuerySchema>

export const CommentTabSchema = z.enum([
  'unread',
  'read',
  'junk',
  'whispers',
  'awaiting',
  'all',
])

/**
 * Admin pager query for `GET /comments`.
 *
 * - `tab` (spec §6.2): inbox filter. Supersedes the numeric `state` parameter.
 * - `state` (deprecated): legacy numeric filter kept as an alias for one
 *   release. When both are supplied, `tab` wins.
 * - `author`: restricts results to comments authored by the given mail OR
 *   originating IP (either matches).
 */
export const CommentAdminPagerSchema = BasicPagerSchema.extend({
  state: z
    .union([
      z.literal('all'),
      z.coerce
        .number()
        .int()
        .refine((val) => [0, 1, 2].includes(val)),
    ])
    .optional(),
  tab: CommentTabSchema.optional(),
  author: z.string().trim().min(1).optional(),
  refType: z.enum(CollectionRefTypes).optional(),
  refId: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
})

export type CommentAdminPagerDto = z.infer<typeof CommentAdminPagerSchema>

/**
 * Query schema for `GET /comments/tab-counts` (spec §6.1).
 */
export const CommentTabCountsQuerySchema = z.object({
  refType: z.enum(CollectionRefTypes).optional(),
  refId: z.string().trim().min(1).optional(),
})

export type CommentTabCountsQueryDto = z.infer<
  typeof CommentTabCountsQuerySchema
>

/**
 * Query schema for `GET /comments/author-activity` (spec §6.3).
 * Validation rejects requests with neither `mail` nor `ip` — the handler
 * re-throws as VALIDATION_FAILED so the wire error shape matches the global
 * Zod path.
 */
export const CommentAuthorActivityQuerySchema = z
  .object({
    mail: z.string().trim().min(1).optional(),
    ip: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .refine((data) => Boolean(data.mail) || Boolean(data.ip), {
    message: 'At least one of mail or ip must be provided',
    path: ['mail'],
  })

export type CommentAuthorActivityQueryDto = z.infer<
  typeof CommentAuthorActivityQuerySchema
>

export const CommentSourceCandidatesQuerySchema = z.object({
  refType: z.enum(CollectionRefTypes).optional(),
  search: z.string().trim().min(1).optional(),
  size: z.coerce.number().int().min(1).max(50).optional(),
})

export type CommentSourceCandidatesQueryDto = z.infer<
  typeof CommentSourceCandidatesQuerySchema
>

/**
 * Comment state patch schema
 */
export const CommentStatePatchSchema = z.object({
  state: z
    .number()
    .int()
    .refine((val) => [0, 1, 2].includes(val))
    .optional(),
  pin: z.boolean().optional(),
})

export type CommentStatePatchDto = z.infer<typeof CommentStatePatchSchema>

/**
 * Batch update comment state schema
 */
export const BatchCommentStateSchema = z
  .object({
    ids: z.array(z.string()).optional(),
    all: z.boolean().optional(),
    state: z
      .number()
      .int()
      .refine((val) => [0, 1, 2].includes(val)),
    currentState: z
      .number()
      .int()
      .refine((val) => [0, 1, 2].includes(val))
      .optional(),
    refType: z.enum(CollectionRefTypes).optional(),
    refId: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.ids?.length || data.all, {
    message: 'Either ids or all must be provided',
  })

export type BatchCommentStateDto = z.infer<typeof BatchCommentStateSchema>

/**
 * Batch delete comment schema
 */
export const BatchCommentDeleteSchema = z
  .object({
    ids: z.array(z.string()).optional(),
    all: z.boolean().optional(),
    state: z
      .number()
      .int()
      .refine((val) => [0, 1, 2].includes(val))
      .optional(),
    refType: z.enum(CollectionRefTypes).optional(),
    refId: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.ids?.length || data.all, {
    message: 'Either ids or all must be provided',
  })

export type BatchCommentDeleteDto = z.infer<typeof BatchCommentDeleteSchema>

// Type exports
export type CommentInput = z.infer<typeof CommentSchema>
export type AnonymousCommentInput = z.infer<typeof AnonymousCommentSchema>
export type AnonymousReplyCommentInput = z.infer<
  typeof AnonymousReplyCommentSchema
>
export type ReaderCommentInput = z.infer<typeof ReaderCommentSchema>
export type ReaderReplyCommentInput = z.infer<typeof ReaderReplyCommentSchema>
export type CommentAnchorInput = z.infer<typeof CommentAnchorSchema>
export type EditCommentInput = z.infer<typeof EditCommentSchema>
export type RequiredGuestReaderCommentInput = z.infer<
  typeof RequiredGuestReaderCommentSchema
>
export type TextOnlyInput = z.infer<typeof TextOnlySchema>
export type CommentRefTypesInput = z.infer<typeof CommentRefTypesSchema>
export type CommentListQueryInput = z.infer<typeof CommentListQuerySchema>
export type CommentStatePatchInput = z.infer<typeof CommentStatePatchSchema>
