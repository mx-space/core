import { redisHelper } from '@/helper/redis-mock.helper'
import { RedisService } from '~/processors/redis/redis.service'
import { defineProvider } from 'test/helper/defineProvider'

export const createRedisProvider = async () =>
  defineProvider({
    provide: RedisService,
    useValue: (await redisHelper).RedisService,
  })
