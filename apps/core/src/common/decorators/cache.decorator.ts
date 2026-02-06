import { CacheKey, CacheTTL } from '@nestjs/cache-manager'
import { SetMetadata } from '@nestjs/common'
import * as META from '~/constants/meta.constant'

interface ICacheOption {
  ttl?: number
  key?: string
  disable?: boolean
  withQuery?: boolean
  force?: boolean
}

export function HttpCache(option: ICacheOption): MethodDecorator {
  const { disable, key, ttl = 60, ...options } = option
  return (_, __, descriptor: PropertyDescriptor) => {
    if (disable) {
      SetMetadata(META.HTTP_CACHE_DISABLE, true)(descriptor.value)
      return descriptor
    }
    if (key) {
      CacheKey(key)(descriptor.value)
    }
    if (typeof ttl === 'number' && !Number.isNaN(ttl)) {
      CacheTTL(ttl)(descriptor.value)
    }

    if (Object.keys(options).length > 0) {
      SetMetadata(META.HTTP_CACHE_META_OPTIONS, options)(descriptor.value)
    }

    return descriptor
  }
}

HttpCache.disable = (_: any, __: any, descriptor: PropertyDescriptor): void => {
  SetMetadata(META.HTTP_CACHE_DISABLE, true)(descriptor.value)
}
