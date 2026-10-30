import { afterEach, describe, expect, it, vi } from 'vitest'

import { uploadFile } from './files'

function mockUploadFetch() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: { url: 'https://cdn/x.jpg', name: 'x.jpg' } }),
  } as Response)
}

function requestedQuery(fetchMock: ReturnType<typeof mockUploadFetch>) {
  const url = String(fetchMock.mock.calls[0][0])
  return new URL(url, 'http://localhost').searchParams
}

describe('uploadFile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('asks the server to keep the original file for a raw upload', async () => {
    const fetchMock = mockUploadFetch()

    await uploadFile(new File(['x'], 'x.jpg'), 'image', { raw: true })

    const query = requestedQuery(fetchMock)
    expect(query.get('type')).toBe('image')
    expect(query.get('raw')).toBe('true')
  })

  it('leaves processing on by default', async () => {
    const fetchMock = mockUploadFetch()

    await uploadFile(new File(['x'], 'x.jpg'), 'image')

    expect(requestedQuery(fetchMock).has('raw')).toBe(false)
  })

  it('requests an immutable version key', async () => {
    const fetchMock = mockUploadFetch()

    await uploadFile(new File(['x'], 'x.js'), 'file', { immutable: true })

    expect(requestedQuery(fetchMock).get('immutable')).toBe('true')
  })
})
