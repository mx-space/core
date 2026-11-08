import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppController } from '~/app.controller'
import { BackupController } from '~/modules/backup/backup.controller'
import { BackupService } from '~/modules/backup/backup.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { HealthController } from '~/modules/health/health.controller'
import { EmailService } from '~/processors/helper/helper.email.service'
import { RedisService } from '~/processors/redis/redis.service'

import { createE2EApp } from '../../../helper/create-e2e-app'

describe('v18 preparation HTTP compatibility', () => {
  const cleanCatch = vi.fn()
  const cleanAllRedisKey = vi.fn()
  const sendTestEmail = vi.fn().mockResolvedValue(undefined)
  const backup = vi.fn()
  const proxy = createE2EApp({
    controllers: [AppController, HealthController, BackupController],
    providers: [
      { provide: RedisService, useValue: { cleanCatch, cleanAllRedisKey } },
      { provide: ConfigsService, useValue: {} },
      { provide: EmailService, useValue: { sendTestEmail } },
      { provide: BackupService, useValue: { backup } },
    ],
  })

  beforeEach(() => vi.clearAllMocks())

  for (const method of ['GET', 'POST'] as const) {
    for (const [url, action] of [
      ['/clean_catch', cleanCatch],
      ['/clean_redis', cleanAllRedisKey],
      ['/health/email/test', sendTestEmail],
    ] as const) {
      it(`${method} ${url} requires authentication and executes once`, async () => {
        const denied = await proxy.app.inject({ method, url })
        expect(denied.statusCode).toBe(401)
        expect(action).not.toHaveBeenCalled()
        const response = await proxy.app.inject({
          method,
          url,
          headers: { 'test-token': 1 },
        })
        expect(response.statusCode).toBe(204)
        expect(action).toHaveBeenCalledTimes(1)
      })
    }

    for (const extension of ['zip', 'mxbackup']) {
      it(`${method} backup preserves ${extension} bytes, filename and type`, async () => {
        const bytes = Buffer.from([0, 255, 80, 75, 1, 2])
        backup.mockResolvedValue({
          path: `/tmp/site.${extension}`,
          buffer: bytes,
        })
        const denied = await proxy.app.inject({ method, url: '/backups/new' })
        expect(denied.statusCode).toBe(401)
        expect(backup).not.toHaveBeenCalled()
        const response = await proxy.app.inject({
          method,
          url: '/backups/new',
          headers: { 'test-token': 1 },
        })
        expect(response.statusCode).toBe(200)
        expect(response.rawPayload).toEqual(bytes)
        expect(response.headers['content-disposition']).toBe(
          `attachment; filename="site.${extension}"`,
        )
        expect(response.headers['content-type']).toContain(
          extension === 'zip' ? 'application/zip' : 'application/octet-stream',
        )
      })
    }
  }
})
