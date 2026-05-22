import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { BasicPagerSchema } from '~/shared/dto/pager.dto'

import { FileTypeEnum } from './file.type'
import { FileReferenceStatus } from './file-reference.enum'

/**
 * File query schema
 */
export const FileQuerySchema = z.object({
  type: z.enum(FileTypeEnum),
  name: z.string(),
})

export class FileQueryDto extends createZodDto(FileQuerySchema) {}

/**
 * File upload schema
 */
export const FileUploadSchema = z.object({
  type: z.enum(FileTypeEnum).optional(),
})

export class FileUploadDto extends createZodDto(FileUploadSchema) {}

/**
 * Rename file query schema
 */
export const RenameFileQuerySchema = z.object({
  newName: z.string(),
})

export class RenameFileQueryDto extends createZodDto(RenameFileQuerySchema) {}

/**
 * Batch orphan delete schema
 */
export const BatchOrphanDeleteSchema = z
  .object({
    ids: z.array(z.string()).optional(),
    all: z.boolean().optional(),
  })
  .refine((data) => data.ids?.length || data.all, {
    message: 'Either ids or all must be provided',
  })

export class BatchOrphanDeleteDto extends createZodDto(
  BatchOrphanDeleteSchema,
) {}

/**
 * Comment uploads list query schema (pagination + filters)
 *
 * Without an explicit DTO, raw @Query() values arrive as strings; the
 * controller then echoes them into withMeta(...).pagination(...) which is
 * validated by ResponseMetaSchema (numeric page/size). Wiring this DTO
 * coerces inputs so admin's flat ?page=1&size=24 calls succeed.
 */
export const CommentUploadsListQuerySchema = BasicPagerSchema.extend({
  status: z.enum(FileReferenceStatus).optional(),
  readerId: z.string().optional(),
  refId: z.string().optional(),
})

export class CommentUploadsListQueryDto extends createZodDto(
  CommentUploadsListQuerySchema,
) {}

// Type exports
export type FileQueryInput = z.infer<typeof FileQuerySchema>
export type FileUploadInput = z.infer<typeof FileUploadSchema>
export type RenameFileQueryInput = z.infer<typeof RenameFileQuerySchema>
export type BatchOrphanDeleteInput = z.infer<typeof BatchOrphanDeleteSchema>
export type CommentUploadsListQueryInput = z.infer<
  typeof CommentUploadsListQuerySchema
>
