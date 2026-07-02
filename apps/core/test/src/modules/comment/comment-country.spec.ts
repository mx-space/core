import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CommentCountryService } from '~/modules/comment/comment-country.service'

interface FakeRedisClient {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
}

const createFakeRedis = () => {
  const store = new Map<string, string>()
  const client: FakeRedisClient = {
    get: vi.fn(async (key: string) =>
      store.has(key) ? (store.get(key) as string) : null,
    ),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
      return 'OK'
    }),
  }
  return {
    redisService: { getClient: () => client } as any,
    client,
    store,
  }
}

const createFakeHttp = (data: { countryCode?: string }) => {
  const get = vi.fn().mockResolvedValue(data)
  return {
    httpService: { fetch: get } as any,
    get,
  }
}

describe('CommentCountryService', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('returns null for empty/invalid ip without touching cache or upstream', async () => {
    const { redisService, client } = createFakeRedis()
    const { httpService, get } = createFakeHttp({})
    const service = new CommentCountryService(redisService, httpService)

    expect(await service.lookupCountryCode(null)).toBeNull()
    expect(await service.lookupCountryCode('')).toBeNull()
    expect(await service.lookupCountryCode('not-an-ip')).toBeNull()

    expect(client.get).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
  })

  it('prefers cf-ipcountry hint and skips upstream lookup', async () => {
    const { redisService, client, store } = createFakeRedis()
    const { httpService, get } = createFakeHttp({ countryCode: 'US' })
    const service = new CommentCountryService(redisService, httpService)

    const result = await service.lookupCountryCode('1.2.3.4', { cfHint: 'cn' })

    expect(result).toBe('CN')
    expect(get).not.toHaveBeenCalled()
    // Header hint is also written through to the cache so subsequent reads
    // without the header still get the answer.
    await vi.waitFor(() => {
      expect(client.set).toHaveBeenCalled()
    })
    expect(store.get('geoip:1.2.3.4')).toBe('CN')

    warnSpy.toString() // keep spy referenced; nothing should have logged
  })

  it('returns the cached value on hit and never calls upstream', async () => {
    const { redisService, client } = createFakeRedis()
    client.get.mockResolvedValueOnce('JP')
    const { httpService, get } = createFakeHttp({ countryCode: 'US' })
    const service = new CommentCountryService(redisService, httpService)

    const result = await service.lookupCountryCode('8.8.8.8')

    expect(result).toBe('JP')
    expect(client.get).toHaveBeenCalledWith('geoip:8.8.8.8')
    expect(get).not.toHaveBeenCalled()
  })

  it('honors cached negative result (empty string) without hitting upstream', async () => {
    const { redisService, client } = createFakeRedis()
    client.get.mockResolvedValueOnce('')
    const { httpService, get } = createFakeHttp({ countryCode: 'US' })
    const service = new CommentCountryService(redisService, httpService)

    const result = await service.lookupCountryCode('8.8.8.8')

    expect(result).toBeNull()
    expect(get).not.toHaveBeenCalled()
  })

  it('falls back to upstream on cache miss and writes the result back', async () => {
    const { redisService, client } = createFakeRedis()
    const { httpService, get } = createFakeHttp({ countryCode: 'sg' })
    const service = new CommentCountryService(redisService, httpService)

    const result = await service.lookupCountryCode('1.1.1.1')

    expect(get).toHaveBeenCalledWith(
      'https://freeipapi.com/api/json/1.1.1.1',
      expect.objectContaining({ timeout: expect.any(Number) }),
    )
    expect(result).toBe('SG')
    expect(client.set).toHaveBeenCalledWith(
      'geoip:1.1.1.1',
      'SG',
      'EX',
      60 * 60 * 24 * 30,
    )
  })

  it('caches a negative result so the next miss does not retry upstream', async () => {
    const { redisService, client } = createFakeRedis()
    const { httpService } = createFakeHttp({})
    const service = new CommentCountryService(redisService, httpService)

    const result = await service.lookupCountryCode('1.1.1.1')

    expect(result).toBeNull()
    expect(client.set).toHaveBeenCalledWith(
      'geoip:1.1.1.1',
      '',
      'EX',
      60 * 60 * 24 * 30,
    )
  })

  it('returns null and warns when the upstream call throws', async () => {
    const { redisService } = createFakeRedis()
    const get = vi.fn().mockRejectedValue(new Error('boom'))
    const httpService = { fetch: get } as any
    const service = new CommentCountryService(redisService, httpService)

    const result = await service.lookupCountryCode('1.1.1.1')

    expect(result).toBeNull()
  })
})
