import { BadRequestException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { AppController } from '~/app.controller'

const createController = () => {
  const redis = {
    sismember: vi.fn().mockResolvedValue(0),
    sadd: vi.fn().mockResolvedValue(1),
  }
  const redisService = {
    getClient: vi.fn(() => redis),
    cleanCatch: vi.fn(),
    cleanAllRedisKey: vi.fn(),
  }
  const configsService = {
    incrementOption: vi.fn(),
    getOptionValue: vi.fn().mockResolvedValue(7),
  }
  const controller = new AppController(
    redisService as any,
    configsService as any,
  )
  return { configsService, controller, redis, redisService }
}

describe('AppController', () => {
  it('returns the liveness pong without a database dependency', () => {
    const { controller } = createController()

    expect(controller.ping()).toBe('pong')
  })

  it('records one like per ip address through Redis and config storage', async () => {
    const { configsService, controller, redis } = createController()

    await controller.likeThis({ ip: '127.0.0.1' } as any)

    expect(redis.sadd).toHaveBeenCalled()
    expect(configsService.incrementOption).toHaveBeenCalledWith('like')
  })

  it('rejects repeated like submissions from the same ip address', async () => {
    const { configsService, controller, redis } = createController()
    redis.sismember.mockResolvedValue(1)

    await expect(
      controller.likeThis({ ip: '127.0.0.1' } as any),
    ).rejects.toThrow(BadRequestException)
    expect(configsService.incrementOption).not.toHaveBeenCalled()
  })
})
