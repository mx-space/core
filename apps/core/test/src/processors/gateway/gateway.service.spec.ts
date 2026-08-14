import { describe, expect, it, vi } from 'vitest'

import { RedisKeys } from '~/constants/cache.constant'
import { GatewayService } from '~/processors/gateway/gateway.service'
import { getRedisKey } from '~/utils/redis.util'

describe('GatewayService', () => {
  it('degrades when redis is not ready', async () => {
    const client = {
      del: vi.fn(),
      hget: vi.fn(),
      hset: vi.fn(),
      hdel: vi.fn(),
    }
    const redisService = {
      getClient: vi.fn(() => client),
      isReady: vi.fn(() => false),
      getStatus: vi.fn(() => 'connecting'),
      isUnavailableError: vi.fn(() => true),
    }

    const service = new GatewayService(redisService as any)
    const warnSpy = vi
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined)

    service.onModuleInit()
    await Promise.resolve()

    await expect(
      service.getSocketMetadata({ id: 'socket-1' } as any),
    ).resolves.toEqual({
      sessionId: '',
      roomJoinedAtMap: {},
    })
    await expect(
      service.setSocketMetadata({ id: 'socket-1' } as any, {
        sessionId: 'session-1',
      }),
    ).resolves.toBeUndefined()
    await expect(
      service.clearSocketMetadata({ id: 'socket-1' } as any),
    ).resolves.toBeUndefined()

    expect(client.del).not.toHaveBeenCalled()
    expect(client.hget).not.toHaveBeenCalled()
    expect(client.hset).not.toHaveBeenCalled()
    expect(client.hdel).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      JSON.stringify({
        module: 'GatewayService',
        message: 'Gateway socket metadata is waiting for Redis',
        redisStatus: 'connecting',
      }),
    )
  })

  it('writes metadata once redis is ready without wiping the shared hash', async () => {
    const client = {
      del: vi.fn().mockResolvedValue(1),
      hget: vi.fn().mockResolvedValue(null),
      hmget: vi.fn().mockResolvedValue([]),
      hset: vi.fn().mockResolvedValue(1),
      hdel: vi.fn(),
    }
    const redisService = {
      getClient: vi.fn(() => client),
      isReady: vi.fn(() => true),
      getStatus: vi.fn(() => 'ready'),
      isUnavailableError: vi.fn(() => false),
    }

    const service = new GatewayService(redisService as any)

    await service.setSocketMetadata({ id: 'socket-1' } as any, {
      sessionId: 'session-1',
    })

    expect(client.del).not.toHaveBeenCalled()
    expect(client.hset).toHaveBeenCalledWith(
      getRedisKey(RedisKeys.Socket),
      'socket-1',
      JSON.stringify({ sessionId: 'session-1', roomJoinedAtMap: {} }),
    )
  })

  it('reads metadata for many connection ids in one hmget', async () => {
    const client = {
      del: vi.fn(),
      hget: vi.fn(),
      hmget: vi
        .fn()
        .mockResolvedValue([JSON.stringify({ sessionId: 'a' }), null]),
      hset: vi.fn(),
      hdel: vi.fn(),
    }
    const redisService = {
      getClient: vi.fn(() => client),
      isReady: vi.fn(() => true),
      getStatus: vi.fn(() => 'ready'),
      isUnavailableError: vi.fn(() => false),
    }

    const service = new GatewayService(redisService as any)

    await expect(
      service.getSocketMetadataMany(['conn-1', 'conn-2']),
    ).resolves.toEqual([
      { sessionId: 'a', roomJoinedAtMap: {} },
      { sessionId: '', roomJoinedAtMap: {} },
    ])
    expect(client.hmget).toHaveBeenCalledWith(
      getRedisKey(RedisKeys.Socket),
      'conn-1',
      'conn-2',
    )
  })
})
