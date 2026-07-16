import type { ResponseMeta } from '~/models/base'

import type { RequestOptions } from './instance'

type NoStringIndex<T> = {
  [K in keyof T as string extends K ? never : K]: T[K]
}

export type Method = 'get' | 'delete' | 'post' | 'put' | 'patch'

export interface IRequestHandler<ResponseWrapper> {
  (path?: string | number): IRequestHandler<ResponseWrapper>
  // @ts-ignore
  get: <P = unknown>(
    options?: Omit<NoStringIndex<RequestOptions>, 'data'>,
  ) => RequestProxyResult<P, ResponseWrapper>
  // @ts-ignore
  post: <P = unknown>(
    options?: RequestOptions,
  ) => RequestProxyResult<P, ResponseWrapper>
  // @ts-ignore
  patch: <P = unknown>(
    options?: RequestOptions,
  ) => RequestProxyResult<P, ResponseWrapper>
  // @ts-ignore
  delete: <P = unknown>(
    options?: Omit<NoStringIndex<RequestOptions>, 'data'>,
  ) => RequestProxyResult<P, ResponseWrapper>
  // @ts-ignore
  put: <P = unknown>(
    options?: RequestOptions,
  ) => RequestProxyResult<P, ResponseWrapper>
  // @ts-ignore
  toString: (withBase?: boolean) => string
  // @ts-ignore
  valueOf: (withBase?: boolean) => string
  [key: string]: IRequestHandler<ResponseWrapper>
}

export type RequestProxyResult<
  T,
  ResponseWrapper,
  R = ResponseWrapper extends unknown
    ? { data: T; [key: string]: any }
    : ResponseWrapper extends { data: T }
      ? ResponseWrapper
      : Omit<ResponseWrapper, 'data'> & { data: T },
> = Promise<ResponseProxyExtraRaw<T, R, ResponseWrapper>>

/**
 * A request result whose protocol owns a response-meta shape distinct from
 * the legacy content API metadata contract.
 */
export type RequestProxyResultWithMeta<
  T,
  ResponseWrapper,
  Meta,
  R = ResponseWrapper extends unknown
    ? { data: T; [key: string]: any }
    : ResponseWrapper extends { data: T }
      ? ResponseWrapper
      : Omit<ResponseWrapper, 'data'> & { data: T },
> = Promise<ResponseProxyExtraRaw<T, R, ResponseWrapper, Meta>>

type CamelToSnake<T extends string, P extends string = ''> = string extends T
  ? string
  : T extends `${infer C0}${infer R}`
    ? CamelToSnake<
        R,
        `${P}${C0 extends Lowercase<C0> ? '' : '_'}${Lowercase<C0>}`
      >
    : P

type CamelKeysToSnake<T> = {
  [K in keyof T as CamelToSnake<Extract<K, string>>]: T[K]
}

type ResponseWrapperType<Response, RawData, T, Meta = ResponseMeta> = {
  $raw: Response extends { data: infer T }
    ? Response
    : Response extends unknown
      ? {
          [i: string]: any
          data: RawData extends unknown ? CamelKeysToSnake<T> : RawData
        }
      : Response
  $request: {
    path: string
    method: string
    [k: string]: string
  }

  $serialized: T

  $meta?: Meta
}

export type ResponseProxyExtraRaw<
  T,
  RawData = unknown,
  Response = unknown,
  Meta = ResponseMeta,
> = T extends object
  ? T & ResponseWrapperType<Response, RawData, T, Meta>
  : T extends unknown
    ? T & ResponseWrapperType<Response, RawData, T, Meta>
    : unknown
