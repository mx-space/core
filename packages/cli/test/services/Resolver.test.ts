import { Effect, Layer } from 'effect'
import { describe, expect, it, vi } from 'vitest'

import {
  Api,
  type ApiError,
  type ApiRequestOptions,
  type ApiService,
} from '../../src/services/Api'
import { Generic } from '../../src/domain/errors'
import {
  isSnowflakeId,
  layer as resolverLayer,
  make,
  matchItem,
  Resolver,
} from '../../src/services/Resolver'

// ---------------------------------------------------------------------------
// Mock API service helpers (self-contained — no test-http.ts)
// ---------------------------------------------------------------------------

type RawResponses = Record<string, unknown | (() => unknown | Promise<unknown>)>

function mockApi(responses: RawResponses): ApiService {
  const raw = (
    path: string,
    _options?: Omit<ApiRequestOptions, 'schema'>,
  ): Effect.Effect<unknown, ApiError> =>
    Effect.tryPromise({
      try: async () => {
        if (!(path in responses)) {
          throw new Error(`unexpected request: ${path}`)
        }
        const v = responses[path]
        return typeof v === 'function' ? await (v as () => unknown)() : v
      },
      catch: (e) =>
        new Generic({
          message: String((e as Error)?.message ?? e),
        }),
    })
  const request = <A, I>(
    path: string,
    options?: ApiRequestOptions<A, I>,
  ): Effect.Effect<A, ApiError> =>
    raw(path, options as Omit<ApiRequestOptions, 'schema'>) as Effect.Effect<
      A,
      ApiError
    >
  return { request, raw }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('isSnowflakeId', () => {
  it('accepts 15-digit numeric ids', () => {
    expect(isSnowflakeId('123456789012345')).toBe(true)
    expect(isSnowflakeId('1234567890123456789')).toBe(true)
  })
  it('rejects short ids and slugs', () => {
    expect(isSnowflakeId('12345')).toBe(false)
    expect(isSnowflakeId('hello-world')).toBe(false)
  })
})

describe('matchItem', () => {
  const items = [
    { id: 'a', slug: 'blog', name: 'Blog' },
    { id: 'b', slug: 'tech', name: 'Technology' },
  ]
  it('matches by exact slug', () => {
    expect(matchItem(items, 'tech')?.id).toBe('b')
  })
  it('matches by exact name', () => {
    expect(matchItem(items, 'Blog')?.id).toBe('a')
  })
  it('matches case-insensitively as fallback', () => {
    expect(matchItem(items, 'BLOG')?.id).toBe('a')
  })
  it('returns null when nothing matches', () => {
    expect(matchItem(items, 'nope')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// resolveCategory / resolveTopic via in-memory mock Api
// ---------------------------------------------------------------------------

describe('resolveCategory / resolveTopic', () => {
  it('returns snowflake ids unchanged without a request', async () => {
    const api = mockApi({})
    const svc = make(api)
    const id = await Effect.runPromise(svc.resolveCategory('123456789012345'))
    expect(id).toBe('123456789012345')
  })

  it('resolves a slug through /categories', async () => {
    const api = mockApi({
      '/categories': { data: [{ id: 'cat-1', slug: 'blog', name: 'Blog' }] },
    })
    const svc = make(api)
    const id = await Effect.runPromise(svc.resolveCategory('blog'))
    expect(id).toBe('cat-1')
  })

  it('fails ValidationFailed with suggestions on unknown slug', async () => {
    const api = mockApi({
      '/categories': { data: [{ id: 'cat-1', slug: 'blog', name: 'Blog' }] },
    })
    const svc = make(api)
    const exit = await Effect.runPromiseExit(svc.resolveCategory('blo'))
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      const err = extractError(exit.cause)
      expect(err?._tag).toBe('ValidationFailed')
      expect((err as any).message).toMatch(/category "blo" not found/)
      // suggestion label picks `name` before `slug` (legacy fuzzySuggest behavior)
      expect((err as any).details?.issues?.[0]?.suggestions).toContain('Blog')
    }
  })

  it('hits topic endpoint /topics/all', async () => {
    const api = mockApi({
      '/topics/all': [{ id: 'topic-1', slug: 'misc', name: 'Misc' }],
    })
    const svc = make(api)
    const id = await Effect.runPromise(svc.resolveTopic('misc'))
    expect(id).toBe('topic-1')
  })

  it('caches list within ttl window', async () => {
    const responses: RawResponses = {
      '/categories': vi.fn(() => ({
        data: [{ id: 'cat-1', slug: 'blog' }],
      })),
    }
    const api = mockApi(responses)
    const svc = make(api)
    await Effect.runPromise(svc.resolveCategory('blog'))
    await Effect.runPromise(svc.resolveCategory('blog'))
    expect(responses['/categories']).toHaveBeenCalledTimes(1)
  })

  it('invalidate(kind) forces re-fetch', async () => {
    const responses: RawResponses = {
      '/categories': vi.fn(() => ({
        data: [{ id: 'cat-1', slug: 'blog' }],
      })),
    }
    const api = mockApi(responses)
    const svc = make(api)
    await Effect.runPromise(svc.resolveCategory('blog'))
    await Effect.runPromise(svc.invalidate('category'))
    await Effect.runPromise(svc.resolveCategory('blog'))
    expect(responses['/categories']).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// resolveCategoryRefs
// ---------------------------------------------------------------------------

describe('resolveCategoryRefs', () => {
  it('maps a list of slugs/ids to ids', async () => {
    const api = mockApi({
      '/categories': {
        data: [
          { id: 'cat-1', slug: 'blog' },
          { id: 'cat-2', slug: 'tech' },
        ],
      },
    })
    const svc = make(api)
    const ids = await Effect.runPromise(
      svc.resolveCategoryRefs(['blog', '999999999999999', 'tech']),
    )
    expect(ids).toEqual(['cat-1', '999999999999999', 'cat-2'])
  })

  it('fails on first unknown ref', async () => {
    const api = mockApi({
      '/categories': { data: [{ id: 'cat-1', slug: 'blog' }] },
    })
    const svc = make(api)
    const exit = await Effect.runPromiseExit(
      svc.resolveCategoryRefs(['blog', 'missing']),
    )
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(extractError(exit.cause)?._tag).toBe('ValidationFailed')
    }
  })
})

// ---------------------------------------------------------------------------
// Direct API resolvers (port of commands/post/note/category/resolve.ts)
// ---------------------------------------------------------------------------

describe('resolvePostReadPath / resolvePostId', () => {
  it('resolves ordinary post slugs through /posts/get-url', async () => {
    const api = mockApi({
      '/posts/get-url/hello-world': { path: '/writing/hello-world' },
    })
    const svc = make(api)
    expect(
      await Effect.runPromise(svc.resolvePostReadPath('hello-world')),
    ).toBe('/posts/writing/hello-world')
  })

  it('resolves a post id by reading the resolved category route', async () => {
    const api = mockApi({
      '/posts/get-url/hello-world': { path: '/writing/hello-world' },
      '/posts/writing/hello-world': { id: 'post-1' },
    })
    const svc = make(api)
    expect(await Effect.runPromise(svc.resolvePostId('hello-world'))).toBe(
      'post-1',
    )
  })

  it('keeps snowflake ids without a network round-trip', async () => {
    const api = mockApi({})
    const svc = make(api)
    expect(
      await Effect.runPromise(svc.resolvePostReadPath('123456789012345')),
    ).toBe('/posts/123456789012345')
  })

  it('fails ResourceNotFound when /posts/get-url returns no path', async () => {
    const api = mockApi({
      '/posts/get-url/missing': {},
    })
    const svc = make(api)
    const exit = await Effect.runPromiseExit(svc.resolvePostId('missing'))
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(extractError(exit.cause)?._tag).toBe('ResourceNotFound')
    }
  })

  it('unwraps the response envelope ({ data: { path } }) from /posts/get-url', async () => {
    const api = mockApi({
      '/posts/get-url/aws-vless': { data: { path: '/writing/aws-vless' } },
    })
    const svc = make(api)
    expect(
      await Effect.runPromise(svc.resolvePostReadPath('aws-vless')),
    ).toBe('/posts/writing/aws-vless')
  })

  it('unwraps the response envelope ({ data: { id } }) from the post detail route', async () => {
    const api = mockApi({
      '/posts/get-url/aws-vless': { data: { path: '/writing/aws-vless' } },
      '/posts/writing/aws-vless': { data: { id: 'post-9' }, meta: {} },
    })
    const svc = make(api)
    expect(await Effect.runPromise(svc.resolvePostId('aws-vless'))).toBe(
      'post-9',
    )
  })
})

describe('resolveNoteId', () => {
  it('returns snowflake ids unchanged', async () => {
    const api = mockApi({})
    const svc = make(api)
    expect(
      await Effect.runPromise(svc.resolveNoteId('123456789012345')),
    ).toBe('123456789012345')
  })

  it('resolves numeric nid through /notes/nid/:nid envelope', async () => {
    const api = mockApi({
      '/notes/nid/42': { data: { id: 'note-1', nid: 42 } },
    })
    const svc = make(api)
    expect(await Effect.runPromise(svc.resolveNoteId('42'))).toBe('note-1')
  })

  it('accepts the flat envelope shape', async () => {
    const api = mockApi({
      '/notes/nid/7': { id: 'note-flat' },
    })
    const svc = make(api)
    expect(await Effect.runPromise(svc.resolveNoteId('7'))).toBe('note-flat')
  })

  it('rejects non-snowflake non-numeric input with ValidationFailed', async () => {
    const api = mockApi({})
    const svc = make(api)
    const exit = await Effect.runPromiseExit(svc.resolveNoteId('hello-world'))
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      const err = extractError(exit.cause)
      expect(err?._tag).toBe('ValidationFailed')
      expect((err as any).message).toMatch(/invalid note reference: hello-world/)
    }
  })

  it('fails ResourceNotFound when nid lookup returns no id', async () => {
    const api = mockApi({
      '/notes/nid/99': { data: {} },
    })
    const svc = make(api)
    const exit = await Effect.runPromiseExit(svc.resolveNoteId('99'))
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(extractError(exit.cause)?._tag).toBe('ResourceNotFound')
    }
  })
})

describe('resolveCategoryId (direct /categories/:slug envelope)', () => {
  it('returns snowflake ids unchanged', async () => {
    const api = mockApi({})
    const svc = make(api)
    expect(
      await Effect.runPromise(svc.resolveCategoryId('123456789012345')),
    ).toBe('123456789012345')
  })

  it('unwraps the double envelope', async () => {
    const api = mockApi({
      '/categories/blog': { data: { id: 'cat-1', name: 'Blog' } },
    })
    const svc = make(api)
    expect(await Effect.runPromise(svc.resolveCategoryId('blog'))).toBe(
      'cat-1',
    )
  })

  it('percent-encodes slug characters before hitting the API', async () => {
    const api = mockApi({
      '/categories/hello%20world': { data: { id: 'cat-2' } },
    })
    const svc = make(api)
    expect(
      await Effect.runPromise(svc.resolveCategoryId('hello world')),
    ).toBe('cat-2')
  })

  it('fails ResourceNotFound when envelope has no id', async () => {
    const api = mockApi({
      '/categories/missing': { data: {} },
    })
    const svc = make(api)
    const exit = await Effect.runPromiseExit(svc.resolveCategoryId('missing'))
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      const err = extractError(exit.cause)
      expect(err?._tag).toBe('ResourceNotFound')
      expect((err as any).message).toMatch(/category not found: missing/)
    }
  })
})

// ---------------------------------------------------------------------------
// Layer wiring: Default Resolver layer composes from Api
// ---------------------------------------------------------------------------

describe('Resolver tag layer wiring', () => {
  it('composes via Layer with an ambient Api service', async () => {
    const api = mockApi({
      '/categories': { data: [{ id: 'cat-1', slug: 'blog' }] },
    })
    const program = Effect.gen(function* () {
      const r = yield* Resolver
      return yield* r.resolveCategory('blog')
    })
    const apiLayer = Layer.succeed(Api, api)
    const out = await Effect.runPromise(
      program.pipe(
        Effect.provide(Resolver.Default),
        Effect.provide(apiLayer),
      ),
    )
    expect(out).toBe('cat-1')
  })

  it('layer(api) helper exposes Resolver service directly', async () => {
    const api = mockApi({
      '/categories': { data: [{ id: 'cat-1', slug: 'blog' }] },
    })
    const program = Effect.flatMap(Resolver, (r) => r.resolveCategory('blog'))
    const out = await Effect.runPromise(
      program.pipe(Effect.provide(resolverLayer(api))),
    )
    expect(out).toBe('cat-1')
  })
})

function extractError(
  cause: unknown,
): { _tag?: string; message?: string; details?: unknown } | undefined {
  const seen = new Set<unknown>()
  const visit = (node: unknown): any => {
    if (!node || typeof node !== 'object' || seen.has(node)) return undefined
    seen.add(node)
    const obj = node as Record<string, unknown>
    if (typeof obj._tag === 'string' && obj._tag !== 'Die' && obj._tag !== 'Fail' && obj._tag !== 'Sequential' && obj._tag !== 'Parallel' && obj._tag !== 'Interrupt' && obj._tag !== 'Empty' && obj._tag !== 'Annotated') {
      return obj
    }
    for (const v of Object.values(obj)) {
      const t = visit(v)
      if (t) return t
    }
    return undefined
  }
  return visit(cause)
}
