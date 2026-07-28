import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zEntityId } from '~/common/zod'
import { DraftRefType } from '~/modules/draft/draft.enum'

export const MigrationMemberPreconditionSchema = z.object({
  kind: z.enum(['source', 'draft', 'translation']),
  id: zEntityId,
  hash: z.string().min(1).max(128),
  version: z.number().int().positive().optional(),
})

export const MarkdownToLexicalMigrationDescriptorSchema = z.object({
  profile: z.literal('yohaku-v1'),
  converterVersion: z.string().min(1).max(64),
  sourceMarkdown: z.string().max(2_000_000),
  sourceHash: z.string().min(1).max(128),
  preconditions: z.array(MigrationMemberPreconditionSchema).max(500),
})

export type MarkdownToLexicalMigrationDescriptor = z.infer<
  typeof MarkdownToLexicalMigrationDescriptorSchema
>

export const MarkdownToLexicalDryRunSchema = z.object({
  refType: z.enum(DraftRefType),
  refId: zEntityId,
  draftId: zEntityId.optional(),
  sourceText: z.string().max(2_000_000),
  profile: z.literal('yohaku-v1'),
})

export class MarkdownToLexicalDryRunDto extends createZodDto(
  MarkdownToLexicalDryRunSchema,
) {}
