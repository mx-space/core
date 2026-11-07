import { describe, expect, it, vi } from 'vitest'

import { createExcalidrawSnapshotSaver } from './excalidraw-snapshot-saver'

describe('createExcalidrawSnapshotSaver', () => {
  it('uploads a hand-saved drawing as a version of the one it replaces', async () => {
    const upload = vi.fn(async () => ({
      url: 'https://cdn.example.test/b.json',
    }))
    const save = createExcalidrawSnapshotSaver(() => '902', upload as never)

    const url = await save({ elements: [] }, 'https://cdn.example.test/a.json')

    expect(url).toBe('https://cdn.example.test/b.json')
    const [file, type, options] = upload.mock.calls[0] as unknown as [
      File,
      string,
      Record<string, unknown>,
    ]
    expect(type).toBe('file')
    expect(await file.text()).toBe('{"elements":[]}')
    expect(options).toMatchObject({
      draftId: '902',
      parentUrl: 'https://cdn.example.test/a.json',
    })
    expect(typeof options.assetKey).toBe('string')
  })

  it('starts a new version chain for a first save', async () => {
    const upload = vi.fn(async () => ({ url: 'u' }))
    const save = createExcalidrawSnapshotSaver(() => undefined, upload as never)

    await save({ elements: [] })

    expect((upload.mock.calls[0] as unknown[])[2]).toMatchObject({
      parentUrl: undefined,
      draftId: undefined,
    })
  })
})
