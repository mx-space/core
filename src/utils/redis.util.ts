import { RedisKeys } from '~/constants/cache.constant'

export const getRedisKey = <T extends string = RedisKeys | '*'>(
  key: T,
  ...concatKeys: string[]
): `mx:${T}${string | ''}` => {
  return `mx:${key}${
    concatKeys && concatKeys.length ? `:${concatKeys.join('_')}` : ''
  }`
}
