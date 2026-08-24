import type { FastifyRequest } from 'fastify'
import { describe, expect, it, vi } from 'vitest'

import { UploadService } from '~/processors/helper/helper.upload.service'

function requestWithFileSpy() {
  const file = vi.fn(async () => ({ fieldname: 'file' }))
  return { file, req: { file } as unknown as FastifyRequest }
}

describe('UploadService.getAndValidMultipartField', () => {
  it('omits the limits option so the plugin-wide file size limit applies', async () => {
    const { file, req } = requestWithFileSpy()
    await new UploadService().getAndValidMultipartField(req)
    expect(file).toHaveBeenCalledWith(undefined)
  })

  it('forwards an explicit maximum file size', async () => {
    const { file, req } = requestWithFileSpy()
    await new UploadService().getAndValidMultipartField(req, {
      maxFileSize: 1024,
    })
    expect(file).toHaveBeenCalledWith({ limits: { fileSize: 1024 } })
  })

  it('rejects a part sent under a field name other than "file"', async () => {
    const req = {
      file: async () => ({ fieldname: 'avatar' }),
    } as unknown as FastifyRequest
    await expect(
      new UploadService().getAndValidMultipartField(req),
    ).rejects.toThrow('The field name must be "file"')
  })
})
