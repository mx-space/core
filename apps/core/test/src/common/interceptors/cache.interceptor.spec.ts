import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { firstValueFrom, of } from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/global/env.global', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/global/env.global')>()
  return { ...actual, isTest: false }
})

const { REDIS } = await import('~/app.config')
const { HttpCacheInterceptor } =
  await import('~/common/interceptors/cache.interceptor')

interface FakeReply {
  raw: { statusCode: number }
  headers: Record<string, string>
  header: (name: string, value: string) => void
  getHeader: (name: string) => string | undefined
}

const createReply = (): FakeReply => {
  const headers: Record<string, string> = {}
  return {
    raw: { statusCode: 200 },
    headers,
    header(name, value) {
      headers[name] = value
    },
    getHeader(name) {
      return headers[name]
    },
  }
}

const createContext = (request: any, reply: FakeReply): ExecutionContext =>
  ({
    getHandler: () => function handler() {},
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => reply,
    }),
  }) as unknown as ExecutionContext

const createHandler = (value: unknown): CallHandler => ({
  handle: () => of(value),
})

const createInterceptor = (store: Map<string, unknown>) => {
  const cacheManager = {
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value)
    }),
  }
  const reflector = { get: vi.fn(() => undefined) }
  const httpAdapterHost = {
    httpAdapter: { getRequestMethod: () => 'GET' },
  }
  const interceptor = new HttpCacheInterceptor(
    cacheManager as any,
    reflector as any,
    httpAdapterHost as any,
  )
  return { interceptor, cacheManager }
}

const baseRequest = (overrides: Record<string, unknown> = {}) => ({
  method: 'GET',
  url: '/posts/paywalled-post',
  query: {},
  hasAdminAccess: false,
  hasReaderIdentity: false,
  isAuthenticated: false,
  ...overrides,
})

describe('HttpCacheInterceptor entitlement-keyed caching', () => {
  const originalDisableApiCache = REDIS.disableApiCache

  beforeEach(() => {
    REDIS.disableApiCache = false
  })

  afterEach(() => {
    REDIS.disableApiCache = originalDisableApiCache
  })

  it('never writes an entitled member response to the shared cache and sends private cache-control', async () => {
    const store = new Map<string, unknown>()
    const { interceptor } = createInterceptor(store)
    const reply = createReply()
    const request = baseRequest({ hasReaderIdentity: true })
    const memberResponse = {
      data: { title: 'Full premium content' },
      meta: { paywall: { locked: false } },
    }

    const observable = await interceptor.intercept(
      createContext(request, reply),
      createHandler(memberResponse),
    )
    const result = await firstValueFrom(observable as any)

    expect(result).toEqual(memberResponse)
    expect(store.size).toBe(0)
    expect(reply.headers['cache-control']).toContain('private')
    expect(reply.headers['cdn-cache-control']).toContain('private')
  })

  it('does not replay a member-primed cache entry to an anonymous visitor', async () => {
    const store = new Map<string, unknown>()

    const { interceptor: memberInterceptor } = createInterceptor(store)
    await firstValueFrom(
      (await memberInterceptor.intercept(
        createContext(baseRequest({ hasReaderIdentity: true }), createReply()),
        createHandler({
          data: { title: 'Full premium content' },
          meta: { paywall: { locked: false } },
        }),
      )) as any,
    )

    expect(store.size).toBe(0)

    const { interceptor: anonInterceptor, cacheManager } =
      createInterceptor(store)
    const anonHandler = vi.fn(() =>
      of({ data: { title: 'teaser' }, meta: { paywall: { locked: true } } }),
    )
    const anonResult = await firstValueFrom(
      (await anonInterceptor.intercept(
        createContext(baseRequest(), createReply()),
        {
          handle: anonHandler,
        },
      )) as any,
    )

    expect(cacheManager.get).toHaveBeenCalled()
    expect(anonHandler).toHaveBeenCalled()
    expect(anonResult).toEqual({
      data: { title: 'teaser' },
      meta: { paywall: { locked: true } },
    })
  })

  it('caches an anonymous locked/teaser response and replays it on a subsequent anonymous request', async () => {
    const store = new Map<string, unknown>()
    const { interceptor: firstInterceptor } = createInterceptor(store)
    const teaserResponse = {
      data: { title: 'teaser' },
      meta: { paywall: { locked: true } },
    }

    await firstValueFrom(
      (await firstInterceptor.intercept(
        createContext(baseRequest(), createReply()),
        createHandler(teaserResponse),
      )) as any,
    )

    expect(store.size).toBe(1)

    const { interceptor: secondInterceptor, cacheManager } =
      createInterceptor(store)
    const secondResult = await firstValueFrom(
      (await secondInterceptor.intercept(
        createContext(baseRequest(), createReply()),
        createHandler({ data: { title: 'should-not-be-returned' } }),
      )) as any,
    )

    expect(cacheManager.get).toHaveBeenCalled()
    expect(secondResult).toEqual(teaserResponse)
  })

  it('skips the cache write for an entitled response even if identity detection regresses', async () => {
    const store = new Map<string, unknown>()
    const { interceptor } = createInterceptor(store)

    await firstValueFrom(
      (await interceptor.intercept(
        createContext(baseRequest(), createReply()),
        createHandler({
          data: { title: 'Full premium content' },
          meta: { paywall: { locked: false } },
        }),
      )) as any,
    )

    expect(store.size).toBe(0)
  })

  it('sends private cache-control headers for any reader-identified request regardless of route', async () => {
    const store = new Map<string, unknown>()
    const { interceptor, cacheManager } = createInterceptor(store)
    const reply = createReply()

    await firstValueFrom(
      (await interceptor.intercept(
        createContext(baseRequest({ hasReaderIdentity: true }), reply),
        createHandler({ data: { ok: true } }),
      )) as any,
    )

    expect(cacheManager.get).not.toHaveBeenCalled()
    expect(cacheManager.set).not.toHaveBeenCalled()
    expect(reply.headers['cache-control']).toContain('private')
  })
})
