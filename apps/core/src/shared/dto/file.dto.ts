import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * File upload schema
 * Note: Actual file validation is typically handled by Fastify/Multer
 */
export const FileUploadSchema = z.object({
  file: z.any(),
})

export class FileUploadDto extends createZodDto(FileUploadSchema) {}

export type FileUploadInput = z.infer<typeof FileUploadSchema>
