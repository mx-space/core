import { isExpiringSoon } from '../../core/auth'
import { readCredentials } from '../../core/config-store'
import { emitSuccess, type OutputOptions } from '../../core/output'
import { type GlobalFlags } from '../_shared'

export async function run(_flags: GlobalFlags, out: OutputOptions) {
  const cred = await readCredentials()
  if (!cred) {
    emitSuccess({ authenticated: false }, out)
    return
  }
  emitSuccess(
    {
      authenticated: true,
      expires_at: cred.expires_at,
      expiring_soon: isExpiringSoon(cred),
      has_refresh: Boolean(cred.refresh_token),
      user: cred.user ?? null,
    },
    out,
  )
}
