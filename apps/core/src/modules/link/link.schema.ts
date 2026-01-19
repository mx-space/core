import { zEmail, zHttpsUrl, zMaxLengthString } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { LinkState, LinkType } from './link.model'

/**
 * Link schema for API validation
 */
export const LinkSchema = z.object({
  name: zMaxLengthString(20, '标题太长了 www'),
  url: zHttpsUrl,
  avatar: z
    .preprocess(
      (val) => (val === '' ? null : val),
      z.string().url().max(200).nullable(),
    )
    .optional(),
  description: zMaxLengthString(50, '描述信息超过 50 会坏掉的！').optional(),
  type: z.enum(LinkType).default(LinkType.Friend).optional(),
  state: z.enum(LinkState).default(LinkState.Pass).optional(),
  email: z
    .preprocess(
      (val) => (val === '' ? null : val),
      zEmail('请输入正确的邮箱！').max(50).nullable(),
    )
    .optional(),
})

export class LinkSchemaDto extends createZodDto(LinkSchema) {}

/**
 * Link DTO with author field (for guest submissions)
 */
export const LinkWithAuthorSchema = LinkSchema.extend({
  author: zMaxLengthString(20, '乃的名字太长了'),
})

export class LinkDto extends createZodDto(LinkWithAuthorSchema) {}

/**
 * Partial link schema for PATCH operations
 */
export const PartialLinkSchema = LinkSchema.partial()

export class PartialLinkDto extends createZodDto(PartialLinkSchema) {}

/**
 * Audit reason schema
 */
export const AuditReasonSchema = z.object({
  reason: z.string().min(1, '请输入审核理由'),
  state: z.enum(LinkState),
})

export class AuditReasonDto extends createZodDto(AuditReasonSchema) {}

// Type exports
export type LinkInput = z.infer<typeof LinkSchema>
export type LinkWithAuthorInput = z.infer<typeof LinkWithAuthorSchema>
export type PartialLinkInput = z.infer<typeof PartialLinkSchema>
export type AuditReasonInput = z.infer<typeof AuditReasonSchema>
