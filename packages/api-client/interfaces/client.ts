import type { IController } from './controller'
import type { Class } from './types'

export interface ResponseAdapterContext {
  url: string
  path: string
  method: string
  options: Record<string, any>
  response: unknown
  meta?: Record<string, any>
}

export interface ResponseAdapter {
  transformData?: <T = any>(data: T, context: ResponseAdapterContext) => T
  transformMeta?: <T = any>(
    meta: T | undefined,
    context: ResponseAdapterContext,
  ) => T | undefined
}

interface IClientOptions {
  controllers: Class<IController>[]
  getCodeMessageFromException: <T = Error>(
    error: T,
  ) => {
    message?: string | undefined | null
    code?: string | number | undefined | null
  }
  customThrowResponseError: <T extends Error = Error>(err: any) => T
  transformResponse: <T = any>(data: any) => T
  /**
   *
   * @default (res) => res.data
   */
  getDataFromResponse: <T = any>(response: unknown) => T
  responseAdapter: ResponseAdapter | ResponseAdapter[]
}
export type ClientOptions = Partial<IClientOptions>
