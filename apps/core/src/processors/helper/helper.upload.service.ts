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
      throw new BadRequestException('仅供上传文件！')
    }
    if (data.fieldname != 'file') {
      throw new BadRequestException('字段必须为 file')
    }

    return data
  }
}
