import { readCredentials } from '../../core/config-store'
import { MxsError } from '../../core/errors'
import { emitSuccess, type OutputOptions } from '../../core/output'
import { type GlobalFlags, resolveContext } from '../internal/shared'

export async function run(flags: GlobalFlags, out: OutputOptions) {
  const ctx = await resolveContext(flags, out)
  const cred = await readCredentials()
  if (!cred) {
    throw new MxsError({
      code: 'auth.missing',
      message: 'not authenticated',
      hint: 'run `mxs auth login`',
    })
  }
  emitSuccess(
    {
      user: cred.user ?? null,
      api_url: ctx.apiUrl,
    },
    out,
  )
}
