import { defineProvider } from 'test/helper/defineProvider'

import { redisHelper } from '@/helper/redis-mock.helper'

import { RedisService } from '~/processors/redis/redis.service'

export const createRedisProvider = async () =>
  defineProvider({
    provide: RedisService,
    useValue: (await redisHelper).RedisService,
  })
