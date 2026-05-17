import { isExpiringSoon } from '../../core/auth'
import { emitSuccess, type OutputOptions } from '../../core/output'
import { getCurrentProfile, readProfileCredentials } from '../../core/profile'
import { type GlobalFlags } from '../internal/shared'

export async function run(_flags: GlobalFlags, out: OutputOptions) {
  const profileName = await getCurrentProfile()
  const cred = profileName ? await readProfileCredentials(profileName) : null
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
