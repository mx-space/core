import type {
  IAdaptorRequestResponseType,
  IRequestAdapter,
} from '~/interfaces/adapter'
import type {
  ClientOptions,
  ResponseAdapter,
  ResponseAdapterContext,
} from '~/interfaces/client'
import type { IController } from '~/interfaces/controller'
import type { RequestOptions } from '~/interfaces/instance'
import type { IRequestHandler, Method } from '~/interfaces/request'
import type { Class } from '~/interfaces/types'
import { isPlainObject, isResponseEnvelope } from '~/utils'
import { camelcaseKeys } from '~/utils/camelcase-keys'
import { resolveFullPath } from '~/utils/path'

import { allControllerNames } from '../controllers'
import { attachRequestMethod } from './attach-request'
import { RequestError } from './error'

const methodPrefix = '_$'

function defaultGetDataFromResponse(res: any) {
  const body = res?.data
  if (!isResponseEnvelope(body)) {
    return body
  }
  if (body.meta && isPlainObject(body.meta.pagination)) {
    return { data: body.data, pagination: body.meta.pagination }
  }
  return body.data
}

function extractResponseMeta(res: any): Record<string, any> | undefined {
  const body = res?.data
  return isResponseEnvelope(body) ? body.meta : undefined
}

function normalizeResponseAdapters(
  responseAdapter: ClientOptions['responseAdapter'],
): ResponseAdapter[] {
  if (!responseAdapter) return []
  return Array.isArray(responseAdapter) ? responseAdapter : [responseAdapter]
}

function applyResponseMetaAdapters(
  meta: Record<string, any> | undefined,
  adapters: ResponseAdapter[],
  context: ResponseAdapterContext,
) {
  return adapters.reduce<Record<string, any> | undefined>((nextMeta, adapter) => {
    return adapter.transformMeta
      ? adapter.transformMeta(nextMeta, { ...context, meta: nextMeta })
      : nextMeta
  }, meta)
}

function applyResponseDataAdapters<T>(
  data: T,
  adapters: ResponseAdapter[],
  context: ResponseAdapterContext,
) {
  return adapters.reduce<T>((nextData, adapter) => {
    return adapter.transformData
      ? adapter.transformData(nextData, context)
      : nextData
  }, data)
}

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
    options.getDataFromResponse ||= defaultGetDataFromResponse

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
            return async (options: RequestOptions = {}) => {
              const path = route.join('/')
              const url = resolveFullPath(that.endpoint, path)
              route.length = 0
              const {
                transformResponse: perRequestTransformResponse,
                ...requestOptions
              } = options
              let res: Record<string, any> & { data: any }
              try {
                res = await manager.request({
                  method: name,
                  ...requestOptions,
                  url,
                })
              } catch (error: any) {
                let message = error.message
                const status: number =
                  error.status ||
                  error.statusCode ||
                  error.response?.status ||
                  error.response?.statusCode ||
                  error.response?.code ||
                  500
                let code: string | number = error.code || status
                let details: unknown

                const errorBody = error?.response?.data ?? error?.data
                const v2Error =
                  errorBody && typeof errorBody === 'object'
                    ? (errorBody as { error?: any }).error
                    : undefined
                if (v2Error && typeof v2Error === 'object') {
                  if (v2Error.code != null) code = v2Error.code
                  if (v2Error.message) message = v2Error.message
                  details = v2Error.details
                }

                if (that.options.getCodeMessageFromException) {
                  const errorInfo =
                    that.options.getCodeMessageFromException(error)
                  message = errorInfo.message || message
                  code = errorInfo.code || code
                }

                throw that.options.customThrowResponseError
                  ? that.options.customThrowResponseError(error)
                  : new RequestError(message, status, url, error, code, details)
              }

              const data = that.options.getDataFromResponse!(res)
              if (!data) {
                return null
              }

              const responseTransformer =
                perRequestTransformResponse === undefined
                  ? that.options.transformResponse
                  : perRequestTransformResponse || undefined

              const cameledObject =
                (Array.isArray(data) || isPlainObject(data)) &&
                responseTransformer
                  ? responseTransformer(data)
                  : data

              const rawMeta = extractResponseMeta(res)
              const transformedMeta =
                rawMeta !== undefined && responseTransformer
                  ? responseTransformer(rawMeta)
                  : rawMeta
              const responseAdapters = normalizeResponseAdapters(
                that.options.responseAdapter,
              )
              const context: ResponseAdapterContext = {
                url,
                path,
                method: name,
                options,
                response: res,
                meta: transformedMeta,
              }
              const adaptedMeta = applyResponseMetaAdapters(
                transformedMeta,
                responseAdapters,
                context,
              )
              const adaptedObject = applyResponseDataAdapters(
                cameledObject,
                responseAdapters,
                { ...context, meta: adaptedMeta },
              )

              let nextObject: any = adaptedObject

              if (adaptedObject && typeof adaptedObject === 'object') {
                nextObject = Array.isArray(adaptedObject)
                  ? [...adaptedObject]
                  : { ...adaptedObject }
                Object.defineProperty(nextObject, '$raw', {
                  get() {
                    return res
                  },
                  enumerable: false,
                  configurable: false,
                })

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
                    return adaptedObject
                  },
                })

                Object.defineProperty(nextObject, '$meta', {
                  get() {
                    return adaptedMeta
                  },
                  enumerable: false,
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
