import FastifyMultipart from '@fastify/multipart'
import {
  BadRequestException,
  Controller,
  Cookies,
  Get,
  Module,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import {
  FastifyAdapter,
  FileInterceptor,
  type NestFastifyApplication,
  type UploadedMultipartFile,
} from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

@Controller('upload-probe')
class UploadProbeController {
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 4 } }))
  upload(@UploadedFile() file?: UploadedMultipartFile) {
    if (!file) throw new BadRequestException('File required')
    return {
      name: file.originalname,
      size: file.size,
      contents: file.buffer?.toString(),
    }
  }

  @Get('cookie')
  cookie(@Cookies('session') session?: string) {
    return { session }
  }
}

@Module({ controllers: [UploadProbeController] })
class UploadProbeModule {}

function multipart(field: string, value: string) {
  return `--boundary\r\nContent-Disposition: form-data; name="${field}"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\n${value}\r\n--boundary--\r\n`
}

describe('Nest 12.1 Fastify upload and cookie integration', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    const adapter = new FastifyAdapter()
    adapter.register(FastifyMultipart, {
      limits: { files: 1, fileSize: 2 },
    })
    const moduleRef = await Test.createTestingModule({
      imports: [UploadProbeModule],
    }).compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(adapter)
    await app.init()
    await adapter.getInstance().ready()
  })

  afterAll(async () => {
    await app?.close()
  })

  it('uses the route limit and provides a buffered file', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/upload-probe',
      headers: { 'content-type': 'multipart/form-data; boundary=boundary' },
      payload: multipart('file', 'abc'),
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual({
      name: 'test.txt',
      size: 3,
      contents: 'abc',
    })
  })

  it('rejects an unexpected field and a file above the route limit', async () => {
    const headers = { 'content-type': 'multipart/form-data; boundary=boundary' }
    const wrongField = await app.inject({
      method: 'POST',
      url: '/upload-probe',
      headers,
      payload: multipart('avatar', 'abc'),
    })
    const tooLarge = await app.inject({
      method: 'POST',
      url: '/upload-probe',
      headers,
      payload: multipart('file', 'abcde'),
    })

    expect(wrongField.statusCode).toBe(400)
    expect(tooLarge.statusCode).toBe(413)
  })

  it('reads a cookie without registering @fastify/cookie', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/upload-probe/cookie',
      headers: { cookie: 'session=abc' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ session: 'abc' })
  })
})
