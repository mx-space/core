import type { MultipartFile } from '@fastify/multipart'
import type { FastifyRequest } from 'fastify'

import { BadRequestException, Injectable } from '@nestjs/common'

@Injectable()
export class UploadService {
  public async getAndValidMultipartField(
    req: FastifyRequest,
  ): Promise<MultipartFile> {
    const data = await req.file()

    if (!data) {
      throw new BadRequestException('仅供上传文件！')
    }
    if (data.fieldname != 'file') {
      throw new BadRequestException('字段必须为 file')
    }

    return data
  }
}
