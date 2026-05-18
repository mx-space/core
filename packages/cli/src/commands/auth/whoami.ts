import { MxsError, MxsErrorCode } from '../../core/errors'
import { emitSuccess, type OutputOptions } from '../../core/output'
import { readProfileCredentials } from '../../core/profile'
import {
  buildApiClient,
  type GlobalFlags,
  resolveContext,
} from '../internal/shared'

export async function run(flags: GlobalFlags, out: OutputOptions) {
  const ctx = await resolveContext(flags, out)
  const cred = ctx.profileName
    ? await readProfileCredentials(ctx.profileName)
    : null
  if (!cred && !ctx.token && !ctx.apiKey) {
    throw new MxsError({
      code: MxsErrorCode.AuthMissing,
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
