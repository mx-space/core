import { FileInterceptor } from '@nestjs/platform-fastify'

import { isZipMinetype } from '~/utils/mine.util'

export const ZipUploadInterceptor = (
  invalidMimeError: (mimetype: string) => Error,
) =>
  FileInterceptor('file', {
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (_req, file, done) => {
      if (isZipMinetype(file.mimetype)) {
        done(null, true)
      } else {
        done(invalidMimeError(file.mimetype), false)
      }
    },
  })
