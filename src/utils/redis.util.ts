import { isInDemoMode } from '~/app.config'
import { RedisKeys } from '~/constants/cache.constant'

type Prefix = 'mx' | 'mx-demo'
const prefix = isInDemoMode ? 'mx-demo' : 'mx'

export const getRedisKey = <T extends string = RedisKeys | '*'>(
  key: T,
  ...concatKeys: string[]
): `${Prefix}:${T}${string | ''}` => {
  return `${prefix}:${key}${
    concatKeys && concatKeys.length ? `:${concatKeys.join('_')}` : ''
  }`
}
