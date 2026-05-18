import { MxsError, MxsErrorCode } from '../../core/errors'
import { emitInfo, type OutputOptions } from '../../core/output'
import { setCurrentProfile, validateProfileName } from '../../core/profile'
import type { GlobalFlags } from '../internal/shared'

export async function run(
  name: string,
  _flags: GlobalFlags,
  out: OutputOptions,
) {
  try {
    validateProfileName(name)
  } catch {
    throw new MxsError({
      code: MxsErrorCode.ProfileInvalidName,
      message: `'${name}' is not a valid profile name`,
      hint: 'profile name must match ^[a-z0-9_-]{1,32}$ and must not be "current"',
    })
  }

  try {
    await setCurrentProfile(name)
  } catch (err: any) {
    if (err?.code === MxsErrorCode.ValidationFailed) {
      throw new MxsError({
        code: MxsErrorCode.ProfileNotFound,
        message: `profile '${name}' does not exist`,
        hint: 'run `mxs profile ls` to see available profiles, or `mxs auth login --profile <name>` to create one',
      })
    }
    throw err
  }

  emitInfo(`mxs: active profile is now '${name}'`, out)
}
