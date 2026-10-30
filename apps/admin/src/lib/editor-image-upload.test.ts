import { afterEach, describe, expect, it, vi } from 'vitest'

import { uploadEditorImage } from './editor-image-upload'

function mockUploadFetch() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: { url: 'https://cdn/x.jpg', name: 'x.jpg' } }),
  } as Response)
}

function requestedQuery(fetchMock: ReturnType<typeof mockUploadFetch>) {
  return new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost')
    .searchParams
}

describe('uploadEditorImage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uploads the original when the dialog asks to keep it', async () => {
    const fetchMock = mockUploadFetch()

    const result = await uploadEditorImage(new File(['x'], 'x.jpg'), {
      keepOriginal: true,
    })

    expect(result).toEqual({ src: 'https://cdn/x.jpg' })
    expect(requestedQuery(fetchMock).get('type')).toBe('image')
    expect(requestedQuery(fetchMock).get('raw')).toBe('true')
  })

  it('lets the server process the image by default', async () => {
    const fetchMock = mockUploadFetch()

    await uploadEditorImage(new File(['x'], 'x.jpg'))

    expect(requestedQuery(fetchMock).has('raw')).toBe(false)
  })
})
