import type { IController } from './controller'
import type { Class } from './types'

interface IClientOptions {
  controllers: Class<IController>[]
  getCodeMessageFromException: <T = Error>(
    error: T,
  ) => {
    message?: string | undefined | null
    code?: number | undefined | null
  }
  customThrowResponseError: <T extends Error = Error>(err: any) => T
  transformResponse: <T = any>(data: any) => T
}
export type ClientOptions = Partial<IClientOptions>
