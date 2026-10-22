import { FileInterceptor } from '@nestjs/platform-fastify'
import { z } from 'zod'

export const RestoreKeySchema = z.string().max(16_384).optional()

// The restore service validates the archive bytes; encrypted backups have no ZIP MIME type.
export const BackupUploadInterceptor = FileInterceptor('file', {
  limits: { fileSize: 100 * 1024 * 1024 },
})
