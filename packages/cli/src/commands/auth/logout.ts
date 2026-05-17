import { MxsError } from '../../core/errors'
import { emitInfo, emitSuccess, type OutputOptions } from '../../core/output'
import { deleteProfileCredentials, getCurrentProfile } from '../../core/profile'
import { type GlobalFlags } from '../internal/shared'

export async function run(flags: GlobalFlags, out: OutputOptions) {
  const target = flags.profile?.trim() || (await getCurrentProfile()) || null

  if (!target) {
    throw new MxsError({
      code: 'profile.none_active',
      message: 'no active profile to log out of',
      hint: 'pass --profile <name> or set an active profile with `mxs profile use <name>`',
    })
  }

  await deleteProfileCredentials(target)
  emitInfo(`mxs: logged out of profile '${target}'`, out)
  emitSuccess({ ok: true }, out)
}
