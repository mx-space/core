/**
 * Cache decorator.
 * @file 缓存装饰器
 * @module decorator/cache
 * @author Surmon <https://github.com/surmon-china>
 */
import { CacheKey, CacheTTL } from '@nestjs/cache-manager'
import { SetMetadata } from '@nestjs/common'
import * as META from '~/constants/meta.constant'

// 缓存器配置
interface ICacheOption {
  ttl?: number
  key?: string
  disable?: boolean

  /**
   * 是否使用查询参数作为缓存键的一部分
   */
  withQuery?: boolean
}

/**
 * 统配构造器
 * @function HttpCache
 * @description 两种用法
 * @example @HttpCache({ key: CACHE_KEY, ttl: 60 * 60 })
 * @example @HttpCache({ disable: true })
 */

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

HttpCache.disable = (_, __, descriptor) => {
  SetMetadata(META.HTTP_CACHE_DISABLE, true)(descriptor.value)
}
