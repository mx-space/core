import { promises as fs } from 'node:fs'

import { confirm, isCancel } from '@clack/prompts'

import { MxsError, MxsErrorCode } from '../../core/errors'
import { emitInfo, type OutputOptions } from '../../core/output'
import {
  getCurrentPath,
  getCurrentProfile,
  removeProfile,
  validateProfileName,
} from '../../core/profile'
import type { GlobalFlags } from '../internal/shared'

export interface RmOpts {
  force?: boolean
}

export async function run(
  name: string,
  opts: RmOpts,
  _flags: GlobalFlags,
  out: OutputOptions,
) {
  validateProfileName(name)

  const current = await getCurrentProfile()
  if (current === name && !opts.force) {
    throw new MxsError({
      code: MxsErrorCode.ValidationFailed,
      message: `profile '${name}' is currently active; pass --force to remove it`,
      hint: 'switch to another profile first with `mxs profile use <name>`',
    })
  }

  if (!opts.force) {
    if (!process.stdin.isTTY) {
      throw new MxsError({
        code: MxsErrorCode.ValidationFailed,
        message: `cannot remove profile '${name}' non-interactively`,
        hint: 'pass --force to confirm removal in a non-interactive context',
      })
    }
    const confirmed = await confirm({
      message: `Remove profile '${name}'? This cannot be undone.`,
    })
    if (isCancel(confirmed) || !confirmed) {
      return
    }
  }

  await removeProfile(name)
  emitInfo(`mxs: profile '${name}' removed`, out)

  if (current === name) {
    // clear the stale active-profile pointer so subsequent commands don't
    // hit profile.not_found on a profile that no longer exists
    await fs.rm(getCurrentPath(), { force: true })
    emitInfo('mxs: cleared active profile pointer', out)
  }
}
