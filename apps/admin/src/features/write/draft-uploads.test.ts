import { describe, expect, it, vi } from 'vitest'

import { createDraftUploads } from './draft-uploads'

function setup() {
  let draftId = ''
  const uploadFile = vi.fn(async () => ({ url: 'https://cdn/x', name: 'x' }))
  const uploadFileWithProgress = vi.fn(async () => ({
    url: 'https://cdn/v',
    name: 'v',
  }))
  const uploads = createDraftUploads(() => draftId, {
    uploadFile: uploadFile as never,
    uploadFileWithProgress: uploadFileWithProgress as never,
  })
  return {
    uploads,
    uploadFile,
    uploadFileWithProgress,
    setDraftId: (id: string) => {
      draftId = id
    },
  }
}

const optionsOf = (mock: ReturnType<typeof vi.fn>, index = 0) =>
  mock.mock.calls[index].at(-1) as Record<string, unknown>

describe('createDraftUploads', () => {
  it('binds every editor upload to the draft open at upload time', async () => {
    const { uploads, uploadFile, uploadFileWithProgress, setDraftId } = setup()
    setDraftId('902')
    const file = new File(['x'], 'x.png')

    await uploads.imageUpload(file)
    await uploads.trackUpload(file)
    await uploads.videoUpload(file, { onProgress: () => {} })
    await uploads.fileUpload(file, { onProgress: () => {} })
    await uploads.saveExcalidrawSnapshot({ elements: [] })

    for (const index of [0, 1, 2])
      expect(optionsOf(uploadFile, index)).toMatchObject({ draftId: '902' })
    for (const index of [0, 1])
      expect(optionsOf(uploadFileWithProgress, index)).toMatchObject({
        draftId: '902',
      })
  })

  it('sends no draft before one exists', async () => {
    const { uploads, uploadFile } = setup()

    await uploads.imageUpload(new File(['x'], 'x.png'))

    expect(optionsOf(uploadFile).draftId).toBeUndefined()
  })
})
