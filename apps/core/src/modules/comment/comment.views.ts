import { z } from 'zod'

const CommentCardSchema = z
  .object({
    id: z.string(),
    author: z.string().nullable().optional(),
    text: z.string(),
    state: z.number().int(),
    createdAt: z.date().or(z.string()),
    refType: z.string(),
    refId: z.string(),
  })
  .loose()

/**
 * `row` view powers the redesigned `/comments` list row (spec §7.2).
 * Adds `countryCode` (ISO 3166-1 alpha-2) populated by
 * `enrichCommentsWithCountry` so the R3 row can render a flag without a
 * follow-up lookup.
 */
const CommentRowSchema = CommentCardSchema.extend({
  countryCode: z.string().nullable().optional(),
})

const CommentRefSummarySchema = z
  .object({
    id: z.string(),
    type: z.string(),
    title: z.string().optional(),
    slug: z.string().nullable().optional(),
    nid: z.number().int().optional(),
    category: z
      .object({ name: z.string(), slug: z.string() })
      .nullable()
      .optional(),
  })
  .loose()

const CommentParentPreviewSchema = z.object({
  id: z.string(),
  author: z.string().nullable(),
  text: z.string(),
  isDeleted: z.boolean(),
})

const CommentDetailSchema = CommentRowSchema.extend({
  mail: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  ip: z.string().nullable().optional(),
  agent: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  authProvider: z.string().nullable().optional(),
  readerId: z.string().nullable().optional(),
  parentCommentId: z.string().nullable().optional(),
  rootCommentId: z.string().nullable().optional(),
  replyCount: z.number().int().optional(),
  latestReplyAt: z.date().or(z.string()).nullable().optional(),
  editedAt: z.date().or(z.string()).nullable().optional(),
  isDeleted: z.boolean().optional(),
  isWhispers: z.boolean().optional(),
  isOwnerReply: z.boolean().optional(),
  pin: z.boolean().optional(),
  ref: CommentRefSummarySchema.nullable().optional(),
  parent: CommentParentPreviewSchema.nullable().optional(),
})

const CommentTabCountsSchema = z
  .object({
    unread: z.number().int(),
    read: z.number().int(),
    junk: z.number().int(),
    whispers: z.number().int(),
    awaiting: z.number().int(),
    all: z.number().int(),
  })
  .loose()

const AuthorActivityItemSchema = z.object({
  id: z.string(),
  createdAt: z.date().or(z.string()),
  refType: z.string(),
  refId: z.string(),
  textExcerpt: z.string(),
  state: z.number().int(),
  isDeleted: z.boolean(),
})

export const CommentViews = {
  public: CommentDetailSchema.omit({
    mail: true,
    ip: true,
    agent: true,
    location: true,
    state: true,
  })
    .extend({
      ref: CommentRefSummarySchema.strip().nullable().optional(),
      moderation: z
        .object({
          status: z.enum(['published', 'pending', 'rejected']),
          reviewer: z.enum(['ai', 'owner']).optional(),
          receipt: z.string().optional(),
        })
        .optional(),
      replyWindow: z
        .object({
          total: z.number(),
          returned: z.number(),
          threshold: z.number(),
          hasHidden: z.boolean(),
          hiddenCount: z.number(),
          nextCursor: z.string().optional(),
        })
        .optional(),
      anchor: z.unknown().optional(),
      reader: z
        .object({
          id: z.string(),
          isMember: z.boolean().optional(),
          name: z.string().nullable().optional(),
          handle: z.string().nullable().optional(),
          username: z.string().nullable().optional(),
          displayUsername: z.string().nullable().optional(),
          image: z.string().nullable().optional(),
          membership: z
            .object({
              status: z.string(),
              plan: z.string(),
            })
            .nullable()
            .optional(),
        })
        .nullable()
        .optional(),
      replies: z.array(z.unknown()).optional(),
      children: z.array(z.unknown()).optional(),
      parent: CommentParentPreviewSchema.nullable().optional(),
    })
    .strip(),
  moderation: z.object({
    status: z.enum(['published', 'pending', 'rejected']),
    reviewer: z.enum(['ai', 'owner']).optional(),
  }),
  card: CommentCardSchema,
  row: CommentRowSchema,
  detail: CommentDetailSchema,
  tabCounts: CommentTabCountsSchema,
  authorActivityItem: AuthorActivityItemSchema,
} as const

export type CommentView = keyof typeof CommentViews
