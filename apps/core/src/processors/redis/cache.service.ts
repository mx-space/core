import { Cache } from 'cache-manager'

import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'

// Cache 客户端管理器

// 获取器
export type TCacheKey = string
export type TCacheResult<T> = Promise<T | undefined>

/**
 * @class CacheService
 * @classdesc 承载缓存服务
 * @example CacheService.get(CacheKey).then()
 * @example CacheService.set(CacheKey).then()
 */
@Injectable()
/**
 * @deprecated
 */
export class CacheService {
  private cache!: Cache
  constructor(@Inject(CACHE_MANAGER) cache: Cache) {
    this.cache = cache
  }

  public get<T>(key: TCacheKey): TCacheResult<T> {
    return this.cache.get<T>(key)
  }

  public set(key: TCacheKey, value: any, milliseconds: number) {
    return this.cache.set(key, value, milliseconds)
  }
}
