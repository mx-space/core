import type {
  IAdaptorRequestResponseType,
  IRequestAdapter,
} from '~/interfaces/adapter'
import type { ClientOptions } from '~/interfaces/client'
import type { IController } from '~/interfaces/controller'
import type { RequestOptions } from '~/interfaces/instance'
import type { IRequestHandler, Method } from '~/interfaces/request'
import type { Class } from '~/interfaces/types'
import { isPlainObject } from '~/utils'
import { camelcaseKeys } from '~/utils/camelcase-keys'
import { resolveFullPath } from '~/utils/path'
import { allControllerNames } from '../controllers'
import { attachRequestMethod } from './attach-request'
import { RequestError } from './error'

const methodPrefix = '_$'
export type { HTTPClient }
class HTTPClient<
  T extends IRequestAdapter = IRequestAdapter,
  ResponseWrapper = unknown,
> {
  private readonly _proxy: IRequestHandler<ResponseWrapper>

  constructor(
    private readonly _endpoint: string,
    private _adaptor: T,
    private options: Omit<ClientOptions, 'controllers'> = {},
  ) {
    this._endpoint = _endpoint.replace(/\/*$/, '')

    this._proxy = this.buildRoute(this)()
    options.transformResponse ||= (data) => camelcaseKeys(data)
    options.getDataFromResponse ||= (res: any) => res.data

    this.initGetClient()

    attachRequestMethod(this)
  }

  private initGetClient() {
    for (const name of allControllerNames) {
      Object.defineProperty(this, name, {
        get() {
          const client: any = Reflect.get(this, `${methodPrefix}${name}`)
          if (!client) {
            throw new ReferenceError(
              `${
                name.charAt(0).toUpperCase() + name.slice(1)
              } Client not inject yet, please inject with client.injectClients(...)`,
            )
          }
          return client
        },
        configurable: false,
        enumerable: false,
      })
    }
  }

  public injectControllers(...Controller: Class<IController>[]): void
  public injectControllers(Controller: Class<IController>[]): void
  public injectControllers(Controller: any, ...rest: any[]) {
    Controller = Array.isArray(Controller) ? Controller : [Controller, ...rest]
    for (const Client of Controller) {
      const cl = new Client(this)

      if (Array.isArray(cl.name)) {
        for (const name of cl.name) {
          attach.call(this, name, cl)
        }
      } else {
        attach.call(this, cl.name, cl)
      }
    }

    function attach(this: any, name: string, cl: IController) {
      Object.defineProperty(this, `${methodPrefix}${name.toLowerCase()}`, {
        get() {
          return cl
        },
        enumerable: false,
        configurable: false,
      })
    }
  }

  get endpoint() {
    return this._endpoint
  }

  get instance() {
    return this._adaptor
  }

  public request(options: {
    url: string
    method?: string
    data?: any
    params?: any
  }) {
    return (this as any)[`$$${String(options.method || 'get').toLowerCase()}`](
      options.url,
      options,
    ) as Promise<IAdaptorRequestResponseType<any>>
  }

  public get proxy() {
    return this._proxy
  }

  private buildRoute(manager: this): () => IRequestHandler<ResponseWrapper> {
    const noop = () => {}
    const methods = ['get', 'post', 'delete', 'patch', 'put']
    const reflectors = [
      'toString',
      'valueOf',
      'inspect',
      'constructor',
      Symbol.toPrimitive,
    ]
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this

    return () => {
      const route = ['']

      const handler: any = {
        get(target: any, name: Method) {
          if (reflectors.includes(name))
            return (withBase?: boolean) => {
              if (withBase) {
                const path = resolveFullPath(that.endpoint, route.join('/'))
                route.length = 0
                return path
              } else {
                const path = route.join('/')
                route.length = 0
                return path.startsWith('/') ? path : `/${path}`
              }
            }
          if (methods.includes(name)) {
            return async (options: RequestOptions) => {
              const url = resolveFullPath(that.endpoint, route.join('/'))
              route.length = 0
              let res: Record<string, any> & { data: any }
              try {
                res = await manager.request({
                  method: name,
                  ...options,
                  url,
                })
              } catch (error: any) {
                let message = error.message
                let code =
                  error.code ||
                  error.status ||
                  error.statusCode ||
                  error.response?.status ||
                  error.response?.statusCode ||
                  error.response?.code ||
                  500

                if (that.options.getCodeMessageFromException) {
                  const errorInfo =
                    that.options.getCodeMessageFromException(error)
                  message = errorInfo.message || message
                  code = errorInfo.code || code
                }

                throw that.options.customThrowResponseError
                  ? that.options.customThrowResponseError(error)
                  : new RequestError(message, code, url, error)
              }

              const data = that.options.getDataFromResponse!(res)
              if (!data) {
                return null
              }

              const cameledObject =
                (Array.isArray(data) || isPlainObject(data)) &&
                that.options.transformResponse
                  ? that.options.transformResponse(data)
                  : data

              let nextObject: any = cameledObject

              if (cameledObject && typeof cameledObject === 'object') {
                nextObject = Array.isArray(cameledObject)
                  ? [...cameledObject]
                  : { ...cameledObject }
                Object.defineProperty(nextObject, '$raw', {
                  get() {
                    return res
                  },
                  enumerable: false,
                  configurable: false,
                })

                // attach request config onto response
                Object.defineProperty(nextObject, '$request', {
                  get() {
                    return {
                      url,
                      method: name,
                      options,
                    }
                  },
                  enumerable: false,
                })

                Object.defineProperty(nextObject, '$serialized', {
                  get() {
                    return cameledObject
                  },
                })
              }

              return nextObject
            }
          }
          route.push(name)
          return new Proxy(noop, handler)
        },
        // @ts-ignore
        apply(target: any, _, args) {
          route.push(...args.filter((x: string) => x !== null))
          return new Proxy(noop, handler)
        },
      }

      return new Proxy(noop, handler) as any
    }
  }
}

export function createClient<T extends IRequestAdapter>(adapter: T) {
  return <
    ResponseWrapper = T extends { responseWrapper: infer Type }
      ? Type extends undefined
        ? unknown
        : Type
      : unknown,
  >(
    endpoint: string,
    options?: ClientOptions,
  ) => {
    const client = new HTTPClient<T, ResponseWrapper>(
      endpoint,
      adapter,
      options,
    )
    const { controllers } = options || {}
    if (controllers) {
      client.injectControllers(controllers)
    }
    return client
  }
}
