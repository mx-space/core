import { Context, Effect, Layer } from 'effect'

// v3 placeholder — interface intentionally empty; a persistent cache layer
// for resolver lookups / API responses lands with v3 observability work.
export interface CacheService {}

export class Cache extends Context.Tag('Cache')<Cache, CacheService>() {
  static Default: Layer.Layer<Cache> = Layer.effect(
    Cache,
    Effect.die('Cache service is a v3 placeholder'),
  )
}
