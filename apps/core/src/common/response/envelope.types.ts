import type { ResponseMeta } from './meta.types'

export interface SuccessEnvelope<T = unknown> {
  data: T
  meta?: ResponseMeta
}

const SUCCESS_ENVELOPE_MARK = Symbol('SuccessEnvelope')

export type ExplicitSuccessEnvelope<T = unknown> = SuccessEnvelope<T> & {
  readonly [SUCCESS_ENVELOPE_MARK]: true
}

export const OK_DATA = { ok: true } as const

export const withMeta = <T>(
  data: T,
  meta: ResponseMeta,
): ExplicitSuccessEnvelope<T> =>
  Object.defineProperty({ data, meta }, SUCCESS_ENVELOPE_MARK, {
    enumerable: false,
    value: true,
  }) as ExplicitSuccessEnvelope<T>

export const isExplicitSuccessEnvelope = <T>(
  value: unknown,
): value is ExplicitSuccessEnvelope<T> =>
  typeof value === 'object' &&
  value !== null &&
  (value as Partial<ExplicitSuccessEnvelope<T>>)[SUCCESS_ENVELOPE_MARK] === true

export interface ErrorEnvelopeBody {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ErrorEnvelope {
  error: ErrorEnvelopeBody
}

export type ResponseEnvelope<T = unknown> = SuccessEnvelope<T> | ErrorEnvelope

export const isSuccessEnvelope = <T>(
  envelope: ResponseEnvelope<T>,
): envelope is SuccessEnvelope<T> => 'data' in envelope

export const isErrorEnvelope = (
  envelope: ResponseEnvelope,
): envelope is ErrorEnvelope => 'error' in envelope
