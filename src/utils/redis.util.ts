import { RedisKeys } from '~/constants/cache.constant'

export const getRedisKey = (key: RedisKeys, ...concatKeys: string[]) => {
  return `mx:${key}${
    concatKeys && concatKeys.length ? '_' + concatKeys.join('_') : ''
  }`
}
