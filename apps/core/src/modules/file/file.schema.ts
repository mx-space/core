import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { FileTypeEnum } from './file.type'

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
  new_name: z.string(),
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
 * Batch S3 upload schema
 */
export const BatchS3UploadSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(20),
})

export class BatchS3UploadDto extends createZodDto(BatchS3UploadSchema) {}

// Type exports
export type FileQueryInput = z.infer<typeof FileQuerySchema>
export type FileUploadInput = z.infer<typeof FileUploadSchema>
export type RenameFileQueryInput = z.infer<typeof RenameFileQuerySchema>
export type BatchOrphanDeleteInput = z.infer<typeof BatchOrphanDeleteSchema>
export type BatchS3UploadInput = z.infer<typeof BatchS3UploadSchema>
