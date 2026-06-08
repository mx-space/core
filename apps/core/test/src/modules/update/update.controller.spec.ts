import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

import type { Observable } from 'rxjs'
import { of } from 'rxjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UpdateController } from '~/modules/update/update.controller'
import type { UpdateService } from '~/modules/update/update.service'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}))

vi.mock('~/constants/path.constant', () => ({
  resolveAdminAssetRoot: vi.fn(() => '/admin'),
}))

function collectObservable(obs$: Observable<string>) {
  const messages: string[] = []
  return new Promise<string[]>((resolve) => {
    obs$.subscribe({
      next: (message) => messages.push(message),
      complete: () => resolve(messages),
      error: () => resolve(messages),
    })
  })
}

describe('UpdateController.updateDashboard', () => {
  const existsSyncMock = vi.mocked(existsSync)
  const readFileMock = vi.mocked(readFile)
  let service: Pick<
    UpdateService,
    'getLatestAdminVersion' | 'startClusterAdminAssetUpdate'
  >
  let controller: UpdateController

  beforeEach(() => {
    existsSyncMock.mockReset()
    readFileMock.mockReset()

    service = {
      getLatestAdminVersion: vi.fn().mockResolvedValue('13.6.0'),
      startClusterAdminAssetUpdate: vi.fn(() => of('started\n')),
    }
    controller = new UpdateController(service as UpdateService)
  })

  it('uses the latest manifest version when local admin assets are missing', async () => {
    existsSyncMock.mockReturnValue(false)

    const messages = await collectObservable(
      await controller.updateDashboard({} as any),
    )

    expect(service.getLatestAdminVersion).toHaveBeenCalledTimes(1)
    expect(service.startClusterAdminAssetUpdate).toHaveBeenCalledWith('13.6.0')
    expect(service.startClusterAdminAssetUpdate).not.toHaveBeenCalledWith(
      '0.0.0',
    )
    expect(messages).toEqual(['started\n'])
  })
})
