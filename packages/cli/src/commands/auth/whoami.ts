import { readCredentials } from '../../core/config-store'
import { MxsError } from '../../core/errors'
import { emitSuccess, type OutputOptions } from '../../core/output'
import { buildApiClient, type GlobalFlags, resolveContext } from '../internal/shared'

export async function run(flags: GlobalFlags, out: OutputOptions) {
  const ctx = await resolveContext(flags, out)
  const cred = await readCredentials()
  if (!cred && !ctx.token && !ctx.apiKey) {
    throw new MxsError({
      code: 'auth.missing',
      message: 'not authenticated',
      hint: 'run `mxs auth login`',
    })
  }
  const client = buildApiClient(ctx, flags)
  const session =
    ctx.token && !ctx.apiKey
      ? await client.request('/auth/session').then((res) => res.data)
      : null
  emitSuccess(
    {
      user: session ?? cred?.user ?? null,
      api_url: ctx.apiUrl,
    },
    out,
  )
}
