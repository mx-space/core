import { rm } from 'node:fs/promises'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorCodeEnum } from '~/constants/error-code.constant'
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
        bizCode: ErrorCodeEnum.InvalidParameter,
      }),
    )
  })

  it('rejects traversal input when deleting backups', async () => {
    await expect(service.deleteBackup('../archive')).rejects.toMatchObject({
      bizCode: ErrorCodeEnum.InvalidParameter,
    })

    expect(rm).not.toHaveBeenCalled()
  })
})
