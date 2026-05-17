export type MxsErrorCode =
  | 'generic'
  | 'argv.parse'
  | 'auth.missing'
  | 'auth.expired'
  | 'auth.denied'
  | 'auth.probe'
  | 'network.timeout'
  | 'network.dns'
  | 'network.refused'
  | 'validation.failed'
  | 'validation.xml'
  | 'server.error'
  | 'resource.not_found'
  | 'config.missing.api_url'
  | 'config.missing.token'
  | (string & {})

export interface MxsErrorOptions {
  code: MxsErrorCode
  message: string
  details?: unknown
  hint?: string
  cause?: unknown
}

export class MxsError extends Error {
  readonly code: MxsErrorCode
  readonly details?: unknown
  readonly hint?: string

  constructor(options: MxsErrorOptions) {
    super(options.message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'MxsError'
    this.code = options.code
    this.details = options.details
    this.hint = options.hint
  }

  toJSON() {
    return {
      ok: false as const,
      code: this.code,
      message: this.message,
      ...(this.details === undefined ? {} : { details: this.details }),
      ...(this.hint === undefined ? {} : { hint: this.hint }),
    }
  }
}

export function exitCodeForError(err: unknown): number {
  if (!(err instanceof MxsError)) return 1
  const code = err.code
  if (code === 'argv.parse') return 2
  if (
    code === 'auth.missing' ||
    code === 'auth.expired' ||
    code === 'auth.denied' ||
    code === 'auth.probe'
  )
    return 3
  if (
    code === 'network.timeout' ||
    code === 'network.dns' ||
    code === 'network.refused'
  )
    return 4
  if (
    code === 'validation.failed' ||
    code === 'validation.xml' ||
    code === 'config.missing.api_url' ||
    code === 'config.missing.token'
  )
    return 5
  if (code === 'server.error') return 6
  if (code === 'resource.not_found') return 7
  return 1
}
