import { access, cp, mkdir, rename, rm, writeFile } from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UpdateInstallService } from '~/modules/update/update-install.service'

const mockZipFiles: Record<
  string,
  { dir: boolean; async: ReturnType<typeof vi.fn> }
> = {}

vi.mock('jszip', () => ({
  default: class MockJSZip {
    files = mockZipFiles

    async loadAsync() {
      return this
    }
  },
}))

vi.mock('~/constants/path.constant', () => ({
  LOCAL_ADMIN_ASSET_PATH: '/admin',
}))

vi.mock('node:fs/promises', async () => {
  const actual =
    await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return {
    ...actual,
    access: vi.fn(),
    cp: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
    rm: vi.fn(),
    writeFile: vi.fn(),
  }
})

describe('UpdateInstallService', () => {
  let service: UpdateInstallService

  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockZipFiles)) {
      delete mockZipFiles[key]
    }
    vi.spyOn(Date, 'now').mockReturnValue(1234567890)
    vi.mocked(mkdir).mockResolvedValue(undefined as any)
    vi.mocked(rm).mockResolvedValue(undefined as any)
    vi.mocked(access).mockRejectedValue(new Error('missing'))
    vi.mocked(rename).mockResolvedValue(undefined as any)
    vi.mocked(cp).mockResolvedValue(undefined as any)
    vi.mocked(writeFile).mockResolvedValue(undefined as any)
    service = new UpdateInstallService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects zip entries that escape the temporary extraction directory', async () => {
    mockZipFiles['../evil.txt'] = {
      dir: false,
      async: vi.fn().mockResolvedValue(Buffer.from('attack')),
    }
    const buffer = new ArrayBuffer(0)
    const pushProgress = vi.fn().mockResolvedValue(undefined)

    await expect(
      service.extractAndInstall(buffer, '1.0.0', pushProgress),
    ).rejects.toThrow('Zip entry escapes target directory')

    expect(mkdir).toHaveBeenCalledWith('/admin_temp_1234567890', {
      recursive: true,
    })
    expect(writeFile).not.toHaveBeenCalled()
    expect(rm).toHaveBeenCalledWith('/admin_temp_1234567890', {
      recursive: true,
      force: true,
    })
  })
})
