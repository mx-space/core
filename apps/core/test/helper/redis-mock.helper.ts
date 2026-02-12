import fs from 'node:fs'
import { CacheService } from '~/processors/redis/cache.service'
import IORedis from 'ioredis'
import type { Redis } from 'ioredis'
import RedisMemoryServer from 'redis-memory-server'

/**
 * 查找系统上的 redis-server 二进制文件
 * 优先级：
 * 1. 环境变量 REDIS_BINARY_PATH
 * 2. 常见的系统路径
 */
function findRedisSystemBinary(): string | undefined {
  // 首先检查环境变量
  const envPath = process.env.REDIS_BINARY_PATH
  if (envPath && fs.existsSync(envPath)) {
    return envPath
  }

  // 常见的 Redis 二进制路径
  const possiblePaths = [
    // macOS Homebrew (Apple Silicon)
    '/opt/homebrew/bin/redis-server',
    // macOS Homebrew (Intel) / Linux common
    '/usr/local/bin/redis-server',
    // Linux 系统默认路径
    '/usr/bin/redis-server',
    // Debian/Ubuntu apt 安装
    '/usr/sbin/redis-server',
    // NixOS
    '/run/current-system/sw/bin/redis-server',
  ]

  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      return path
    }
  }

  // 如果都找不到，返回 undefined，让 redis-memory-server 自己下载
  return undefined
}

export class MockCacheService {
  private client: Redis
  constructor(port: number, host: string) {
    this.client = new IORedis(port, host)
  }

  private get redisClient() {
    return this.client
  }

  public get(key) {
    return this.client.get(key)
  }

  public set(key, value: any) {
    return this.client.set(key, value)
  }

  public getClient() {
    return this.redisClient
  }
}

const createMockRedis = async () => {
  const systemBinary = findRedisSystemBinary()

  const redisServer = new RedisMemoryServer({
    binary: systemBinary ? { systemBinary } : undefined,
  })

  const redisHost = await redisServer.getHost()
  const redisPort = await redisServer.getPort()

  const cacheService = new MockCacheService(redisPort, redisHost)

  return {
    connect: () => null,
    CacheService: cacheService,
    RedisService: cacheService,

    token: CacheService,

    async close() {
      await cacheService.getClient().flushall()
      await cacheService.getClient().quit()
      await redisServer.stop()
    },
  }
}

export const redisHelper = createMockRedis()
