import { AppException } from '~/common/errors/exception.types'

import { AppErrorCode } from './app-error-code'
import { APP_ERROR_DEFINITIONS } from './app-error-definitions'
import type { AppErrorPayloadMap } from './app-error-payload'

type RequiredKeys<T extends object> = {
  [K in keyof T]-?: Record<K, T[K]> extends T ? never : K
}[keyof T]

type NonUndefined<T> = Exclude<T, undefined>
type PayloadFor<C extends AppErrorCode> = AppErrorPayloadMap[C]
type RuntimeAppErrorDefinition = {
  status: number
  message: string | ((payload: unknown) => string)
  details?: (payload: unknown) => Record<string, unknown> | undefined
}

type AppErrorArgs<C extends AppErrorCode> = [PayloadFor<C>] extends [undefined]
  ? [code: C]
  : undefined extends PayloadFor<C>
    ? NonUndefined<PayloadFor<C>> extends object
      ? RequiredKeys<NonUndefined<PayloadFor<C>>> extends never
        ? [code: C, payload?: NonUndefined<PayloadFor<C>>]
        : [code: C, payload: NonUndefined<PayloadFor<C>>]
      : never
    : NonUndefined<PayloadFor<C>> extends object
      ? RequiredKeys<NonUndefined<PayloadFor<C>>> extends never
        ? [code: C, payload?: NonUndefined<PayloadFor<C>>]
        : [code: C, payload: NonUndefined<PayloadFor<C>>]
      : never

export function createAppException<C extends AppErrorCode>(
  ...args: AppErrorArgs<C>
): AppException {
  const [code, payload] = args as [
    AppErrorCode,
    NonUndefined<AppErrorPayloadMap[AppErrorCode]> | undefined,
  ]
  const definition = APP_ERROR_DEFINITIONS[code] as RuntimeAppErrorDefinition
  const message =
    typeof definition.message === 'function'
      ? definition.message(payload)
      : definition.message
  const details = definition.details?.(payload)

  return new AppException(code, message, definition.status, details)
}

export { AppErrorCode }
