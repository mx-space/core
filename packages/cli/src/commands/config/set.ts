import { MxsError, MxsErrorCode } from '../../core/errors'
import { emitSuccess, type OutputOptions } from '../../core/output'
import {
  buildApiClient,
  type GlobalFlags,
  resolveContext,
} from '../internal/shared'

export interface ConfigSetFlags {
  type?: 'json' | 'string' | 'number' | 'bool'
}

export async function run(
  key: string,
  value: string,
  opts: ConfigSetFlags,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const coerced = coerce(value, opts.type)
  if (flags.dryRun) {
    emitSuccess({ key, value: coerced }, out)
    return
  }
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const res = await client.request(`/options/${key}`, {
    method: 'PATCH',
    body: coerced,
  })
  emitSuccess(res.data, out)
}

function coerce(value: string, type?: ConfigSetFlags['type']): unknown {
  if (type === 'string') return value
  if (type === 'number') {
    const n = Number(value)
    if (Number.isNaN(n))
      throw new MxsError({
        code: MxsErrorCode.ValidationFailed,
        message: `invalid number: ${value}`,
      })
    return n
  }
  if (type === 'bool') return value === 'true'
  if (type === 'json' || type === undefined) {
    try {
      return JSON.parse(value)
    } catch {
      if (type === 'json')
        throw new MxsError({
          code: MxsErrorCode.ValidationFailed,
          message: `invalid JSON: ${value}`,
        })
      return value
    }
  }
  return value
}
