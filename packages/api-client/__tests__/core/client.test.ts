/* eslint-disable unicorn/custom-error-definition */
import { axiosAdaptor } from '~/adaptors/axios'
import { umiAdaptor } from '~/adaptors/umi-request'
import {
  allControllerNames,
  allControllers,
  NoteController,
  PostController,
} from '~/controllers'
import { createClient, RequestError } from '~/core'
import type { IRequestAdapter } from '~/interfaces/adapter'
import type { ClientOptions } from '~/interfaces/client'
import { AxiosError } from 'axios'
import type { AxiosResponse } from 'axios'
import { vi } from 'vitest'

const { spyOn } = vi

// axios wrapper test
const generateClient = <
  Response = AxiosResponse<unknown>,
  AdaptorType extends IRequestAdapter = typeof axiosAdaptor,
>(
  adapter?: AdaptorType,
  options?: ClientOptions,
) =>
  createClient(adapter ?? axiosAdaptor)<Response>(
    'http://127.0.0.1:2323',
    options,
  )
describe('test client', () => {
  it('should create new client with axios', () => {
    const client = generateClient()
    expect(client).toBeDefined()
  })

  describe('client `get` method', () => {
    test('case 1', async () => {
      spyOn(axiosAdaptor, 'get').mockImplementation((url) => {
        if (url === 'http://127.0.0.1:2323/a/a?foo=bar') {
          return Promise.resolve({ data: { ok: 1 } })
        }

        return Promise.resolve({ data: null })
      })

      const client = generateClient()
      const data = await client.proxy.a.a.get({ params: { foo: 'bar' } })

      expect(data).toStrictEqual({ ok: 1 })
    })

    test('case 2', async () => {
      spyOn(axiosAdaptor, 'get').mockImplementation((url) => {
        if (url === 'http://127.0.0.1:2323/a/a') {
          return Promise.resolve({ data: { ok: 1 } })
        }

        return Promise.resolve({ data: null })
      })

      const client = generateClient()
      const data = await client.proxy.a.a.get()

      expect(data).toStrictEqual({ ok: 1 })

      {
        spyOn(axiosAdaptor, 'get').mockImplementation((url) => {
          if (url === 'http://127.0.0.1:2323/a/b') {
            return Promise.resolve({ data: { ok: 1 } })
          }

          return Promise.resolve({ data: null })
        })

        const client = generateClient()
        const data = await client.proxy.a.b.get()

        expect(data).toStrictEqual({ ok: 1 })
      }
    })
  })

  it('should throw error if not inject other client', () => {
    const client = generateClient()
    allControllerNames.forEach((name) => {
      expect(() => (client as any)[name].name).toThrow(
        `${
          name.charAt(0).toUpperCase() + name.slice(1)
        } Client not inject yet, please inject with client.injectClients(...)`,
      )
    })
  })

  it('should work if inject client', () => {
    const client = generateClient()

    client.injectControllers(allControllers)
    allControllerNames.forEach((name) => {
      expect(() => (client as any)[name].name).toBeDefined()
    })
  })

  it('should inject single client worked', () => {
    const client = generateClient()

    client.injectControllers(PostController)
    expect(client.post.name).toBeDefined()
  })

  it('should inject multi client worked', () => {
    const client = generateClient()

    client.injectControllers(PostController, NoteController)
    expect(client.post.name).toBeDefined()
    expect(client.note.name).toBeDefined()
  })

  it('should inject controller when init', () => {
    const client = createClient(axiosAdaptor)('http://127.0.0.1:2323', {
      controllers: [PostController, NoteController],
    })
    expect(client.post.name).toBeDefined()
    expect(client.note.name).toBeDefined()
  })

  it('should infer response wrapper type', async () => {
    const client = generateClient<AxiosResponse>(axiosAdaptor)
    client.injectControllers(PostController)
    spyOn(axiosAdaptor, 'get').mockImplementation((url) => {
      if (url === 'http://127.0.0.1:2323/posts/latest') {
        return Promise.resolve({ data: { ok: 1 }, status: 200 })
      }

      return Promise.resolve({ data: null })
    })

    const data = await client.post.getLatest()

    expect(data.$raw.status).toBe(200)
  })

  it('should infer axios instance type', async () => {
    const client = generateClient<AxiosResponse>(axiosAdaptor)
    spyOn(axiosAdaptor, 'get').mockImplementation((url) => {
      if (url === 'http://127.0.0.1:2323/a') {
        return Promise.resolve({ data: { ok: 1 }, status: 200 })
      }

      return Promise.resolve({ data: null })
    })
    expect(client.instance.default).toBe(axiosAdaptor.default)
    const res = await client.proxy.a.get()
    expect(res.$raw.status).toBe(200)

    {
      spyOn(umiAdaptor, 'get').mockImplementation((url) => {
        if (url === 'http://127.0.0.1:2323/a') {
          return Promise.resolve({
            data: { ok: 1 },
            response: { status: 200, body: {} },
          })
        }

        return Promise.resolve({ data: null })
      })
      const client2 = createClient(umiAdaptor)('http://127.0.0.1:2323')
      expect(client2.instance.default).toBe(umiAdaptor.default)
      const res = await client2.proxy.a.get()
      expect(res.$raw.response.status).toBe(200)
      expect(res.$raw.response.body).toStrictEqual({})
    }
  })

  it('should resolve joint path call toString()', () => {
    const client = generateClient()
    {
      const path = client.proxy.foo.bar.toString()
      expect(path).toBe('/foo/bar')
    }

    {
      const path = client.proxy.foo.bar.toString(true)
      expect(path).toBe('http://127.0.0.1:2323/foo/bar')
    }
  })

  it('should do not json convert case if payload is string or other primitive type', async () => {
    const client = generateClient<AxiosResponse>(axiosAdaptor)
    spyOn(axiosAdaptor, 'get').mockImplementation((url) => {
      if (url === 'http://127.0.0.1:2323/a') {
        return Promise.resolve({ data: 'foo', status: 200 })
      }

      return Promise.resolve({ data: null })
    })

    const data = await client.proxy.a.get()
    expect(data).toBe('foo')
  })

  it('should throw exception with custom message and code', async () => {
    const client = generateClient<AxiosResponse>(axiosAdaptor, {
      // @ts-ignore
      getCodeMessageFromException: (e: AxiosError) => {
        return {
          code: e.response?.status,
          message: e.message,
        }
      },
    })
    spyOn(axiosAdaptor, 'get').mockImplementation(() => {
      return Promise.reject(
        new AxiosError(
          'not found',
          'NOT_FOUND',
          {},
          {},
          {
            status: 404,
            config: {},
            data: {},
            headers: {},
            statusText: 'not found',
          },
        ),
      )
    })

    try {
      await client.proxy.a.get()
    } catch (error: any) {
      expect(error).toBeInstanceOf(RequestError)
      expect(error.status).toBe(404)
    }
  })

  it('should throw custom exception', async () => {
    class MyRequestError extends Error {
      constructor(
        message: string,
        public status: number,
        public path: string,
        public raw: any,
      ) {
        super(message)
      }

      toResponse() {
        return {
          status: this.status,
        }
      }
    }

    const client = generateClient<AxiosResponse>(axiosAdaptor, {
      // @ts-ignore
      customThrowResponseError(err) {
        return new MyRequestError(
          err.message,
          err.response?.status,
          err.path,
          err.raw,
        )
      },
    })

    spyOn(axiosAdaptor, 'get').mockImplementation(() => {
      return Promise.reject(
        new AxiosError(
          'not found',
          'NOT_FOUND',
          {},
          {},
          {
            status: 404,
            config: {},
            data: {},
            headers: {},
            statusText: 'not found',
          },
        ),
      )
    })

    try {
      await client.proxy.a.get()
    } catch (error: any) {
      expect(error).toBeInstanceOf(MyRequestError)
      expect(error.toResponse).toBeDefined()
      expect(error.status).toBe(404)
    }
  })
})
