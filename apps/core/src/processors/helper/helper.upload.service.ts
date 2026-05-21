import type { MultipartFile } from '@fastify/multipart'
import { BadRequestException, Injectable } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

@Injectable()
export class UploadService {
  public async getAndValidMultipartField(
    req: FastifyRequest,

    options?: {
      maxFileSize?: number
    },
  ): Promise<MultipartFile> {
    const data = await req.file({
      limits: {
        fileSize: options?.maxFileSize,
      },
    })

    if (!data) {
      throw new BadRequestException('Only file uploads are accepted!')
    }
    if (data.fieldname != 'file') {
      throw new BadRequestException('The field name must be "file"')
    }

    return data
  }
}
