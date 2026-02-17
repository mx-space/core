import { rm } from 'node:fs/promises'
import { Injectable, Logger } from '@nestjs/common'
import { RedisService } from '~/processors/redis/redis.service'
import { PKG } from '~/utils/pkg.util'
import pc from 'picocolors'
import { Observable } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { UpdateDownloadService } from './update-download.service'
import { UpdateInstallService } from './update-install.service'

const { repo } = PKG.dashboard!

const REDIS_KEY_PREFIX = 'update:admin'

const LUA_RELEASE_LOCK = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`

const LUA_EXTEND_LOCK = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("expire", KEYS[1], ARGV[2])
else
  return 0
end
`

const INSTALL_LOCK_KEY = `${REDIS_KEY_PREFIX}:install-lock`

@Injectable()
export class UpdateService {
  private readonly logger = new Logger(UpdateService.name)
  private readonly LOCK_TTL_SEC = 600
  private readonly BUFFER_TTL_SEC = 600
  private readonly STREAM_MAX_LEN = 200
  private readonly DOWNLOAD_TIMEOUT = 1800000
  private readonly INSTALL_LOCK_TTL_SEC = 120

  constructor(
    private readonly redisService: RedisService,
    private readonly downloadService: UpdateDownloadService,
    private readonly installService: UpdateInstallService,
  ) {}

  private get redis() {
    return this.redisService.getClient()
  }

  private buildKeys(version: string) {
    return {
      lockKey: `${REDIS_KEY_PREFIX}:lock:${version}`,
      streamKey: `${REDIS_KEY_PREFIX}:stream:${version}`,
      bufferKey: `${REDIS_KEY_PREFIX}:buffer:${version}`,
      doneKey: `${REDIS_KEY_PREFIX}:done:${version}`,
      errorKey: `${REDIS_KEY_PREFIX}:error:${version}`,
    }
  }

  downloadAdminAsset(version: string) {
    const observable$ = new Observable<string>((subscriber) => {
      ;(async () => {
        try {
          const keys = this.buildKeys(version)
          const instanceId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

          const lockResult = await this.redis.set(
            keys.lockKey,
            instanceId,
            'EX',
            this.LOCK_TTL_SEC,
            'NX',
          )

          if (lockResult === 'OK') {
            await this.runAsLeader(version, keys, instanceId, subscriber)
          } else {
            await this.runAsFollower(version, keys, subscriber)
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error)
          subscriber.next(pc.red(`Update failed: ${errorMsg}\n`))
          subscriber.complete()
        }
      })()
    })

    return observable$.pipe(
      catchError((err) => {
        this.logger.error('Download observable error:', err)
        return observable$
      }),
    )
  }

  private async runAsLeader(
    version: string,
    keys: ReturnType<typeof this.buildKeys>,
    instanceId: string,
    subscriber: any,
  ) {
    this.logger.log(`Leader elected (${instanceId}) for v${version}`)

    await this.redis.del(keys.doneKey, keys.errorKey, keys.streamKey)

    const heartbeat = setInterval(
      () => {
        this.redis
          .eval(LUA_EXTEND_LOCK, 1, keys.lockKey, instanceId, this.LOCK_TTL_SEC)
          .catch(() => {})
      },
      Math.floor(this.LOCK_TTL_SEC * 500),
    )

    try {
      const pushProgress = async (msg: string) => {
        subscriber.next(msg)
        await this.redis
          .xadd(
            keys.streamKey,
            'MAXLEN',
            '~',
            this.STREAM_MAX_LEN,
            '*',
            'type',
            'progress',
            'data',
            msg,
          )
          .catch(() => {})
      }

      const endpoint = `https://api.github.com/repos/${repo}/releases/tags/v${version}`
      await pushProgress(`Getting release info from ${endpoint}.\n`)

      const releaseInfo = await this.downloadService.fetchWithRetry(endpoint, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mix-Space-Admin-Updater',
          Accept: 'application/vnd.github.v3+json',
        },
      })

      if (!releaseInfo?.assets) {
        throw new Error('Release assets not found')
      }

      const asset = releaseInfo.assets.find(
        (asset: any) => asset.name === 'release.zip',
      )

      if (!asset) {
        const msg = `release.zip not found. Available: ${releaseInfo.assets.map((a: any) => a.name).join(', ')}`
        throw new Error(msg)
      }

      const downloadUrl = asset.browser_download_url
      const fileSize = asset.size

      await pushProgress(
        `Found release.zip (${this.downloadService.formatBytes(fileSize)})\n`,
      )

      const buffer = await this.downloadService.downloadWithMirrors(
        downloadUrl,
        fileSize,
        async (msg: string) => pushProgress(msg),
      )

      if (!buffer) {
        throw new Error('All download sources failed')
      }

      await pushProgress('Storing buffer to Redis for other instances...\n')
      await this.redis.setex(
        keys.bufferKey,
        this.BUFFER_TTL_SEC,
        Buffer.from(buffer),
      )

      await this.acquireInstallLock(instanceId)
      const installHeartbeat = this.startInstallLockHeartbeat(instanceId)
      try {
        await this.installService.extractAndInstall(
          buffer,
          version,
          async (msg: string) => pushProgress(msg),
        )
      } finally {
        clearInterval(installHeartbeat)
        await this.releaseInstallLock(instanceId)
      }

      await this.redis.expire(keys.bufferKey, this.BUFFER_TTL_SEC)
      await this.redis.setex(keys.doneKey, this.BUFFER_TTL_SEC, version)
      await this.redis.xadd(
        keys.streamKey,
        'MAXLEN',
        '~',
        this.STREAM_MAX_LEN,
        '*',
        'type',
        'done',
        'data',
        version,
      )
      await this.redis.expire(keys.streamKey, this.BUFFER_TTL_SEC)

      subscriber.next(
        pc.green(
          `Admin asset v${version} downloaded and installed successfully.\n`,
        ),
      )
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      await this.redis.setex(keys.errorKey, 300, errorMsg)
      await this.redis
        .xadd(
          keys.streamKey,
          'MAXLEN',
          '~',
          this.STREAM_MAX_LEN,
          '*',
          'type',
          'error',
          'data',
          errorMsg,
        )
        .catch(() => {})
      await this.redis
        .expire(keys.streamKey, this.BUFFER_TTL_SEC)
        .catch(() => {})

      subscriber.next(pc.red(`Download failed: ${errorMsg}\n`))
      await rm('admin-release.zip', { force: true }).catch(() => {})
    } finally {
      clearInterval(heartbeat)
      await this.redis
        .eval(LUA_RELEASE_LOCK, 1, keys.lockKey, instanceId)
        .catch(() => {})
      subscriber.complete()
    }
  }

  private async runAsFollower(
    version: string,
    keys: ReturnType<typeof this.buildKeys>,
    subscriber: any,
  ) {
    this.logger.log(`Follower joining update stream for v${version}`)
    subscriber.next(
      pc.cyan('Another instance is downloading, waiting for completion...\n'),
    )

    try {
      const alreadyDone = await this.redis.get(keys.doneKey)
      if (alreadyDone) {
        subscriber.next('Update already completed by another instance.\n')
        await this.installFromRedisBuffer(version, keys, subscriber)
        subscriber.complete()
        return
      }

      let lastId = '0-0'
      const startAt = Date.now()
      const timeoutMs = this.DOWNLOAD_TIMEOUT + 60000

      while (true) {
        if (Date.now() - startAt > timeoutMs) {
          throw new Error('Follower wait timeout')
        }

        const response = await this.redis.xread(
          'BLOCK',
          2000,
          'STREAMS',
          keys.streamKey,
          lastId,
        )

        if (!response) {
          const done = await this.redis.get(keys.doneKey)
          if (done) break

          const errorMsg = await this.redis.get(keys.errorKey)
          if (errorMsg) {
            throw new Error(`Leader failed: ${errorMsg}`)
          }

          const lockExists = await this.redis.exists(keys.lockKey)
          if (!lockExists) {
            const done = await this.redis.get(keys.doneKey)
            if (done) break
            throw new Error('Leader lost without completion')
          }
          continue
        }

        for (const [, entries] of response) {
          for (const [id, fields] of entries) {
            lastId = id
            const record = this.parseStreamFields(fields)

            if (record.type === 'progress') {
              subscriber.next(pc.dim(`[leader] ${record.data}`))
            } else if (record.type === 'error') {
              throw new Error(`Leader failed: ${record.data}`)
            }
          }
        }

        const done = await this.redis.get(keys.doneKey)
        if (done) break
      }

      await this.installFromRedisBuffer(version, keys, subscriber)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      subscriber.next(pc.red(`Follower update failed: ${errorMsg}\n`))
    } finally {
      subscriber.complete()
    }
  }

  private async installFromRedisBuffer(
    version: string,
    keys: ReturnType<typeof this.buildKeys>,
    subscriber: any,
  ) {
    subscriber.next('Fetching buffer from Redis...\n')

    const bufferData = await this.redis.getBuffer(keys.bufferKey)
    if (!bufferData) {
      throw new Error(
        'Buffer expired in Redis, please retry the update manually',
      )
    }

    const buffer: ArrayBuffer = bufferData.buffer.slice(
      bufferData.byteOffset,
      bufferData.byteOffset + bufferData.byteLength,
    ) as ArrayBuffer

    const instanceId = `${process.pid}-${Date.now()}`
    await this.acquireInstallLock(instanceId)
    const installHeartbeat = this.startInstallLockHeartbeat(instanceId)
    try {
      await this.installService.extractAndInstall(
        buffer,
        version,
        async (msg: string) => {
          subscriber.next(msg)
        },
      )
    } finally {
      clearInterval(installHeartbeat)
      await this.releaseInstallLock(instanceId)
    }

    subscriber.next(
      pc.green(
        `Admin asset v${version} installed from Redis buffer successfully.\n`,
      ),
    )
  }

  private async acquireInstallLock(instanceId: string) {
    const startAt = Date.now()
    while (true) {
      const result = await this.redis.set(
        INSTALL_LOCK_KEY,
        instanceId,
        'EX',
        this.INSTALL_LOCK_TTL_SEC,
        'NX',
      )
      if (result === 'OK') return

      if (Date.now() - startAt > this.INSTALL_LOCK_TTL_SEC * 1000) {
        throw new Error('Install lock acquisition timeout')
      }
      await this.sleep(500)
    }
  }

  private startInstallLockHeartbeat(instanceId: string) {
    return setInterval(
      () => {
        this.redis
          .eval(
            LUA_EXTEND_LOCK,
            1,
            INSTALL_LOCK_KEY,
            instanceId,
            this.INSTALL_LOCK_TTL_SEC,
          )
          .catch(() => {})
      },
      Math.floor(this.INSTALL_LOCK_TTL_SEC * 500),
    )
  }

  private async releaseInstallLock(instanceId: string) {
    await this.redis
      .eval(LUA_RELEASE_LOCK, 1, INSTALL_LOCK_KEY, instanceId)
      .catch(() => {})
  }

  private parseStreamFields(fields: string[]): {
    type: string
    data: string
  } {
    const record: Record<string, string> = {}
    for (let i = 0; i < fields.length; i += 2) {
      record[fields[i]] = fields[i + 1]
    }
    return { type: record.type ?? 'unknown', data: record.data ?? '' }
  }

  async getLatestAdminVersion() {
    const endpoint = `https://api.github.com/repos/${repo}/releases/latest`

    try {
      const data = await this.downloadService.fetchWithRetry(endpoint, {
        headers: {
          'User-Agent': 'Mix-Space-Admin-Updater',
          Accept: 'application/vnd.github.v3+json',
        },
      })

      const tag = data?.tag_name
      if (!tag) {
        throw new Error('tag_name not found in release info')
      }
      return tag.replace(/^v/, '')
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to get latest version: ${errorMsg}`, {
        cause: error,
      })
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
