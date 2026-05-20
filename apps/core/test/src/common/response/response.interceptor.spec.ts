import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { firstValueFrom, of } from 'rxjs'

import { withMeta } from '~/common/response/envelope.types'
import { ResponseInterceptorV2 } from '~/common/response/response.interceptor'

interface FakeResponse {
  statusCode?: number
  status: (code: number) => FakeResponse
}

const createResponse = (): FakeResponse => {
  const res: FakeResponse = {
    status(code: number) {
      res.statusCode = code
      return res
    },
  }
  return res
}

const createContext = (options: {
  hasRequest?: boolean
  response?: FakeResponse
}): ExecutionContext => {
  const { hasRequest = true, response } = options
  return {
    getHandler: () => () => void 0,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => (hasRequest ? {} : undefined),
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext
}

const createHandler = (value: unknown): CallHandler => ({
  handle: () => of(value),
})

const run = (
  interceptor: NestInterceptor,
  context: ExecutionContext,
  value: unknown,
) => firstValueFrom(interceptor.intercept(context, createHandler(value)) as any)

describe('ResponseInterceptorV2', () => {
  const make = (passthrough = false) =>
    new ResponseInterceptorV2({
      getAllAndOverride: () => passthrough,
    } as any)

  test('wraps a bare object in a data envelope', async () => {
    const result = await run(make(), createContext({}), {
      id: '1',
      title: 'Hello',
    })

    expect(result).toEqual({ data: { id: '1', title: 'Hello' } })
  })

  test('wraps a bare array in a data envelope', async () => {
    const result = await run(make(), createContext({}), [1, 2, 3])

    expect(result).toEqual({ data: [1, 2, 3] })
  })

  test('wraps a null value in a data envelope', async () => {
    const result = await run(make(), createContext({}), null)

    expect(result).toEqual({ data: null })
  })

  test('passes through an explicit metadata envelope', async () => {
    const envelope = withMeta({ id: '1' }, { view: 'detail' })
    const result = await run(make(), createContext({}), envelope)

    expect(result).toEqual({ data: { id: '1' }, meta: { view: 'detail' } })
  })

  test('wraps an object that looks like a data-only envelope', async () => {
    const result = await run(make(), createContext({}), { data: [1, 2] })

    expect(result).toEqual({ data: { data: [1, 2] } })
  })

  test('converts camelCase keys in data to snake_case', async () => {
    const result = await run(make(), createContext({}), {
      createdAt: 1,
      categoryId: '2',
    })

    expect(result).toEqual({ data: { created_at: 1, category_id: '2' } })
  })

  test('converts camelCase keys in explicit metadata', async () => {
    const envelope = withMeta({ id: '1' }, { totalPages: 3 } as any)
    const result = await run(make(), createContext({}), envelope)

    expect(result).toEqual({ data: { id: '1' }, meta: { total_pages: 3 } })
  })

  test('wraps an object that merely has a data property among other keys', async () => {
    const value = { data: 'x', name: 'config' }
    const result = await run(make(), createContext({}), value)

    expect(result).toEqual({ data: { data: 'x', name: 'config' } })
  })

  test('emits 204 with no body for undefined', async () => {
    const response = createResponse()
    const result = await run(make(), createContext({ response }), undefined)

    expect(result).toBeUndefined()
    expect(response.statusCode).toBe(204)
  })

  test('skips transformation when the route opts out via passthrough metadata', async () => {
    const value = [1, 2, 3]
    const result = await run(make(true), createContext({}), value)

    expect(result).toBe(value)
  })

  test('skips transformation when there is no HTTP request context', async () => {
    const value = { id: '1' }
    const result = await run(
      make(),
      createContext({ hasRequest: false }),
      value,
    )

    expect(result).toBe(value)
  })
})
