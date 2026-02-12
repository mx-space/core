import { copyFile, mkdir, unlink } from 'node:fs/promises'
import { FileService } from '~/modules/file/file.service'
import { describe, expect, it, vi } from 'vitest'

vi.mock('~/constants/path.constant', () => {
  return {
    STATIC_FILE_DIR: '/static',
    STATIC_FILE_TRASH_DIR: '/trash',
  }
})

vi.mock('node:fs/promises', () => {
  return {
    access: vi.fn(),
    copyFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
  }
})

describe('FileService.deleteFile', () => {
  const createService = () => new FileService({} as any)

  it('should be idempotent when source file is missing (ENOENT)', async () => {
    vi.mocked(mkdir).mockResolvedValue(undefined as any)
    vi.mocked(copyFile).mockRejectedValueOnce(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    )

    const service = createService()
    await expect(
      service.deleteFile('image' as any, 'missing.jpg'),
    ).resolves.toBeUndefined()

    expect(mkdir).toHaveBeenCalledWith('/trash', { recursive: true })
    expect(copyFile).toHaveBeenCalledWith(
      '/static/image/missing.jpg',
      '/trash/missing.jpg',
    )
    expect(unlink).not.toHaveBeenCalled()
  })

  it('should copy to trash then unlink source', async () => {
    vi.mocked(mkdir).mockResolvedValue(undefined as any)
    vi.mocked(copyFile).mockResolvedValue(undefined as any)
    vi.mocked(unlink).mockResolvedValue(undefined as any)

    const service = createService()
    await service.deleteFile('image' as any, 'ok.jpg')

    expect(mkdir).toHaveBeenCalledWith('/trash', { recursive: true })
    expect(copyFile).toHaveBeenCalledWith(
      '/static/image/ok.jpg',
      '/trash/ok.jpg',
    )
    expect(unlink).toHaveBeenCalledWith('/static/image/ok.jpg')
  })

  it('should ignore ENOENT from unlink after copy', async () => {
    vi.mocked(mkdir).mockResolvedValue(undefined as any)
    vi.mocked(copyFile).mockResolvedValue(undefined as any)
    vi.mocked(unlink).mockRejectedValueOnce(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    )

    const service = createService()
    await expect(
      service.deleteFile('image' as any, 'race.jpg'),
    ).resolves.toBeUndefined()
  })
})
