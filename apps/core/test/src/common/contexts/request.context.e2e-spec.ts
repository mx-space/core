import {
  Controller,
  Get,
  MiddlewareConsumer,
  Module,
  NestModule,
  Query,
} from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { RequestContext } from '~/common/contexts/request.context'
import { Lang } from '~/common/decorators/lang.decorator'
import { RequestContextMiddleware } from '~/common/middlewares/request-context.middleware'
import { setupE2EApp } from 'test/helper/setup-e2e'

const wait = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const normalizeHeader = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value

@Controller('request-context')
class RequestContextTestController {
  @Get('probe')
  async probe() {
    const initialContext = RequestContext.currentRequestContext()
    const initialRequest = RequestContext.currentRequest()
    const requestId = normalizeHeader(initialRequest?.headers['x-request-id'])

    if (!initialContext || !initialRequest) {
      return { requestId, consistent: false }
    }

    const checkSame = () =>
      RequestContext.currentRequestContext() === initialContext &&
      RequestContext.currentRequest() === initialRequest

    const checks: boolean[] = []
    checks.push(checkSame())

    await Promise.resolve()
    checks.push(checkSame())

    await wait(0)
    checks.push(checkSame())

    await new Promise<void>((resolve) => process.nextTick(resolve))
    checks.push(checkSame())

    const parallelChecks = await Promise.all([
      (async () => {
        await wait(1)
        return checkSame()
      })(),
      (async () => {
        await Promise.resolve()
        return checkSame()
      })(),
    ])

    checks.push(...parallelChecks)

    return { requestId, consistent: checks.every(Boolean) }
  }

  @Get('lang')
  async getLang(@Lang() lang?: string) {
    return {
      lang,
      contextLang: RequestContext.currentLang(),
    }
  }

  @Get('lang-with-query')
  async getLangWithQuery(
    @Query('lang') queryLang: string,
    @Lang() lang?: string,
  ) {
    return {
      queryLang,
      lang,
      contextLang: RequestContext.currentLang(),
    }
  }
}

@Module({
  controllers: [RequestContextTestController],
})
class RequestContextTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes(RequestContextTestController)
  }
}

describe('RequestContext (e2e)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await setupE2EApp({
      imports: [RequestContextTestModule],
    })
  })

  afterAll(async () => {
    await app.close()
  })

  test('keeps context through a request lifecycle', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/request-context/probe',
      headers: {
        'x-request-id': 'req-1',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = await res.json()
    expect(body.requestId).toBe('req-1')
    expect(body.consistent).toBe(true)
  })

  test('does not leak context across concurrent requests', async () => {
    const [resA, resB] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/request-context/probe',
        headers: {
          'x-request-id': 'req-a',
        },
      }),
      app.inject({
        method: 'GET',
        url: '/request-context/probe',
        headers: {
          'x-request-id': 'req-b',
        },
      }),
    ])

    expect(resA.statusCode).toBe(200)
    expect(resB.statusCode).toBe(200)

    const bodyA = await resA.json()
    const bodyB = await resB.json()

    expect(bodyA.requestId).toBe('req-a')
    expect(bodyB.requestId).toBe('req-b')
    expect(bodyA.consistent).toBe(true)
    expect(bodyB.consistent).toBe(true)
  })

  describe('x-lang header and @Lang() decorator', () => {
    test('extracts lang from x-lang header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/request-context/lang',
        headers: {
          'x-lang': 'en',
        },
      })

      expect(res.statusCode).toBe(200)
      const body = await res.json()
      expect(body.lang).toBe('en')
      expect(body.contextLang).toBe('en')
    })

    test('normalizes language code from header (en-US -> en)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/request-context/lang',
        headers: {
          'x-lang': 'en-US',
        },
      })

      expect(res.statusCode).toBe(200)
      const body = await res.json()
      expect(body.lang).toBe('en')
      expect(body.contextLang).toBe('en')
    })

    test('normalizes zh-CN to zh', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/request-context/lang',
        headers: {
          'x-lang': 'zh-CN',
        },
      })

      expect(res.statusCode).toBe(200)
      const body = await res.json()
      expect(body.lang).toBe('zh')
      expect(body.contextLang).toBe('zh')
    })

    test('returns undefined when no lang is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/request-context/lang',
      })

      expect(res.statusCode).toBe(200)
      const body = await res.json()
      expect(body.lang).toBeUndefined()
      expect(body.contextLang).toBeUndefined()
    })

    test('query lang takes priority over header lang', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/request-context/lang-with-query?lang=zh',
        headers: {
          'x-lang': 'en',
        },
      })

      expect(res.statusCode).toBe(200)
      const body = await res.json()
      expect(body.queryLang).toBe('zh')
      expect(body.lang).toBe('zh')
      expect(body.contextLang).toBe('en')
    })

    test('falls back to header lang when query lang is not provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/request-context/lang-with-query',
        headers: {
          'x-lang': 'ja',
        },
      })

      expect(res.statusCode).toBe(200)
      const body = await res.json()
      expect(body.queryLang).toBeUndefined()
      expect(body.lang).toBe('ja')
      expect(body.contextLang).toBe('ja')
    })

    test('isolates lang across concurrent requests', async () => {
      const [resEn, resZh, resJa] = await Promise.all([
        app.inject({
          method: 'GET',
          url: '/request-context/lang',
          headers: { 'x-lang': 'en' },
        }),
        app.inject({
          method: 'GET',
          url: '/request-context/lang',
          headers: { 'x-lang': 'zh' },
        }),
        app.inject({
          method: 'GET',
          url: '/request-context/lang',
          headers: { 'x-lang': 'ja' },
        }),
      ])

      expect(resEn.statusCode).toBe(200)
      expect(resZh.statusCode).toBe(200)
      expect(resJa.statusCode).toBe(200)

      const bodyEn = await resEn.json()
      const bodyZh = await resZh.json()
      const bodyJa = await resJa.json()

      expect(bodyEn.lang).toBe('en')
      expect(bodyZh.lang).toBe('zh')
      expect(bodyJa.lang).toBe('ja')
    })
  })
})
