import { rm } from 'node:fs/promises'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { BackupService } from '~/modules/backup/backup.service'

vi.mock('~/constants/path.constant', () => ({
  BACKUP_DIR: '/backup',
  DATA_DIR: '/data',
}))

vi.mock('node:fs/promises', async () => {
  const actual =
    await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return {
    ...actual,
    rm: vi.fn(),
  }
})

describe('BackupService path validation', () => {
  let service: BackupService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new BackupService({} as any, {} as any, {} as any)
  })

  it('rejects traversal input when resolving backup files', () => {
    expect(() => service.checkBackupExist('../archive')).toThrowError(
      expect.objectContaining({
        code: AppErrorCode.INVALID_PARAMETER,
      }),
    )
  })

  it('rejects traversal input when deleting backups', async () => {
    await expect(service.deleteBackup('../archive')).rejects.toMatchObject({
      code: AppErrorCode.INVALID_PARAMETER,
    })

    expect(rm).not.toHaveBeenCalled()
  })
})

it('rejects a ZIP with too many expanded entries before extraction', async () => {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (let i = 0; i < 10001; i++) zip.file(`entry-${i}`, '')
  const service = new BackupService({} as any, {} as any, {} as any)
  await expect(
    (service as any).safeUnzip(
      await zip.generateAsync({ type: 'nodebuffer' }),
      '/tmp/mx-security-archive-limit',
    ),
  ).rejects.toThrow(/entries|limit/i)
})
