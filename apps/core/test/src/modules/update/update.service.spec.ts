import { Test } from '@nestjs/testing'
import { ConfigsService } from '~/modules/configs/configs.service'
import { UpdateDownloadService } from '~/modules/update/update-download.service'
import { UpdateInstallService } from '~/modules/update/update-install.service'
import { UpdateService } from '~/modules/update/update.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import { RedisService } from '~/processors/redis/redis.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'

class FakeRedis {
  private store = new Map<string, string | Buffer>()
  private streams = new Map<string, Array<[string, string[]]>>()
  private streamSeq = 0

  async get(key: string) {
    const val = this.store.get(key)
    if (val instanceof Buffer) return val.toString()
    return val ?? null
  }

  async getBuffer(key: string) {
    const val = this.store.get(key)
    if (val instanceof Buffer) return val
    if (typeof val === 'string') return Buffer.from(val)
    return null
  }

  async set(key: string, value: string | Buffer, ...args: any[]) {
    const hasNx = args.includes('NX')
    if (hasNx && this.store.has(key)) {
      return null
    }
    this.store.set(key, value)
    return 'OK'
  }

  async setex(key: string, _ttl: number, value: string | Buffer) {
    this.store.set(key, value)
    return 'OK'
  }

  async exists(key: string) {
    return this.store.has(key) ? 1 : 0
  }

  async expire(_key: string, _seconds: number) {
    return 1
  }

  async del(...keys: string[]) {
    for (const key of keys) this.store.delete(key)
    return keys.length
  }

  async eval(_script: string, _numKeys: number, ...args: any[]) {
    const key = args[0] as string
    const expectedValue = args[1] as string
    const currentValue = this.store.get(key)
    const currentStr =
      currentValue instanceof Buffer ? currentValue.toString() : currentValue
    if (currentStr === expectedValue) {
      this.store.delete(key)
      return 1
    }
    return 0
  }

  async xadd(key: string, ...args: (string | number)[]) {
    const strArgs = args.map(String)
    const starIndex = strArgs.lastIndexOf('*')
    const fields = strArgs.slice(starIndex + 1)
    const id = `${++this.streamSeq}-0`
    const entries = this.streams.get(key) || []
    entries.push([id, fields])
    this.streams.set(key, entries)
    return id
  }

  async xread(
    _block: string,
    _ms: number,
    _streams: string,
    key: string,
    lastId: string,
  ) {
    const entries = this.streams.get(key) || []
    const startIndex =
      lastId === '0-0'
        ? 0
        : entries.findIndex((entry) => entry[0] === lastId) + 1

    const nextEntries = entries.slice(Math.max(0, startIndex))
    if (!nextEntries.length) return null
    return [[key, nextEntries]]
  }

  _set(key: string, value: string | Buffer) {
    this.store.set(key, value)
  }

  _has(key: string) {
    return this.store.has(key)
  }
}

function subscribeOnce(obs$: import('rxjs').Observable<string>) {
  const messages: string[] = []
  return new Promise<string[]>((resolve) => {
    obs$.subscribe({
      next: (msg) => messages.push(msg),
      complete: () => resolve(messages),
      error: () => resolve(messages),
    })
  })
}

describe('UpdateService', () => {
  let service: UpdateService
  let downloadService: UpdateDownloadService
  let installService: UpdateInstallService
  let fakeRedis: FakeRedis

  beforeEach(async () => {
    fakeRedis = new FakeRedis()

    const mockHttpService = {
      axiosRef: { get: vi.fn() },
    }

    const mockConfigsService = {
      get: vi.fn().mockResolvedValue({ githubToken: '' }),
    }

    const module = await Test.createTestingModule({
      providers: [
        UpdateService,
        UpdateDownloadService,
        UpdateInstallService,
        { provide: RedisService, useValue: { getClient: () => fakeRedis } },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigsService, useValue: mockConfigsService },
      ],
    }).compile()

    service = module.get(UpdateService)
    downloadService = module.get(UpdateDownloadService)
    installService = module.get(UpdateInstallService)
    vi.spyOn(installService, 'extractAndInstall').mockResolvedValue(undefined)
  })

  describe('leader election', () => {
    it('first caller becomes leader and completes', async () => {
      vi.spyOn(downloadService, 'fetchWithRetry').mockResolvedValue({
        assets: [
          {
            name: 'release.zip',
            browser_download_url: 'https://example.com/r.zip',
            size: 100,
          },
        ],
      })
      vi.spyOn(downloadService, 'downloadWithMirrors').mockResolvedValue(
        new ArrayBuffer(100),
      )

      const messages = await subscribeOnce(service.downloadAdminAsset('1.0.0'))

      expect(messages.length).toBeGreaterThan(0)
      expect(fakeRedis._has('update:admin:lock:1.0.0')).toBe(false)
      expect(await fakeRedis.get('update:admin:done:1.0.0')).toBe('1.0.0')
      expect(fakeRedis._has('update:admin:buffer:1.0.0')).toBe(true)
    })

    it('second caller becomes follower', async () => {
      fakeRedis._set('update:admin:lock:1.0.0', 'other-instance')
      fakeRedis._set('update:admin:done:1.0.0', '1.0.0')
      fakeRedis._set('update:admin:buffer:1.0.0', Buffer.from('zip'))

      const messages = await subscribeOnce(service.downloadAdminAsset('1.0.0'))

      expect(
        messages.some(
          (m) =>
            m.includes('Another instance') || m.includes('already completed'),
        ),
      ).toBe(true)
    })
  })

  describe('follower behavior', () => {
    it('installs from Redis buffer when already done', async () => {
      fakeRedis._set('update:admin:lock:2.0.0', 'leader')
      fakeRedis._set('update:admin:done:2.0.0', '2.0.0')
      fakeRedis._set('update:admin:buffer:2.0.0', Buffer.from('zip'))

      const messages = await subscribeOnce(service.downloadAdminAsset('2.0.0'))

      expect(messages.some((m) => m.includes('Fetching buffer'))).toBe(true)
      expect(installService.extractAndInstall).toHaveBeenCalled()
    })

    it('detects leader error', async () => {
      fakeRedis._set('update:admin:lock:3.0.0', 'leader')
      fakeRedis._set('update:admin:error:3.0.0', 'Boom')

      const messages = await subscribeOnce(service.downloadAdminAsset('3.0.0'))

      expect(messages.some((m) => m.includes('Leader failed'))).toBe(true)
    })

    it('detects leader error from stream', async () => {
      fakeRedis._set('update:admin:lock:4.0.0', 'leader')

      await fakeRedis.xadd(
        'update:admin:stream:4.0.0',
        'MAXLEN',
        '~',
        '200',
        '*',
        'type',
        'error',
        'data',
        'Download exploded',
      )

      const messages = await subscribeOnce(service.downloadAdminAsset('4.0.0'))

      expect(messages.some((m) => m.includes('Leader failed'))).toBe(true)
    })
  })

  describe('leader error handling', () => {
    it('writes error to Redis on failure', async () => {
      vi.spyOn(downloadService, 'fetchWithRetry').mockRejectedValue(
        new Error('Net error'),
      )

      const messages = await subscribeOnce(service.downloadAdminAsset('6.0.0'))

      expect(messages.some((m) => m.includes('Download failed'))).toBe(true)
      expect(await fakeRedis.get('update:admin:error:6.0.0')).toContain(
        'Net error',
      )
    })

    it('writes error when release.zip not found', async () => {
      vi.spyOn(downloadService, 'fetchWithRetry').mockResolvedValue({
        assets: [{ name: 'other.zip' }],
      })

      const messages = await subscribeOnce(service.downloadAdminAsset('7.0.0'))

      expect(messages.some((m) => m.includes('Download failed'))).toBe(true)
    })
  })

  describe('getLatestAdminVersion', () => {
    it('strips v prefix', async () => {
      vi.spyOn(downloadService, 'fetchWithRetry').mockResolvedValue({
        tag_name: 'v2.5.0',
      })
      expect(await service.getLatestAdminVersion()).toBe('2.5.0')
    })

    it('throws when tag_name missing', async () => {
      vi.spyOn(downloadService, 'fetchWithRetry').mockResolvedValue({})
      await expect(service.getLatestAdminVersion()).rejects.toThrow(
        'tag_name not found',
      )
    })
  })

  describe('install lock', () => {
    it('acquires NX lock', async () => {
      await (service as any).acquireInstallLock('test')
      expect(fakeRedis._has('update:admin:install-lock')).toBe(true)
    })

    it('waits then acquires when held', async () => {
      fakeRedis._set('update:admin:install-lock', 'other')
      setTimeout(() => fakeRedis.del('update:admin:install-lock'), 100)
      await (service as any).acquireInstallLock('test')
      expect(fakeRedis._has('update:admin:install-lock')).toBe(true)
    })
  })

  describe('stale state cleanup', () => {
    it('leader cleans old done/error before starting', async () => {
      fakeRedis._set('update:admin:done:8.0.0', 'stale')
      fakeRedis._set('update:admin:error:8.0.0', 'stale error')

      vi.spyOn(downloadService, 'fetchWithRetry').mockResolvedValue({
        assets: [{ name: 'release.zip', browser_download_url: 'u', size: 10 }],
      })
      vi.spyOn(downloadService, 'downloadWithMirrors').mockResolvedValue(
        new ArrayBuffer(10),
      )

      await subscribeOnce(service.downloadAdminAsset('8.0.0'))

      expect(await fakeRedis.get('update:admin:done:8.0.0')).toBe('8.0.0')
    })
  })
})
