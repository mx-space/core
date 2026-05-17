import { confirm, isCancel } from '@clack/prompts'

import { MxsError } from '../../core/errors'
import { emitInfo, type OutputOptions } from '../../core/output'
import {
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
      code: 'validation.failed',
      message: `profile '${name}' is currently active; pass --force to remove it`,
      hint: 'switch to another profile first with `mxs profile use <name>`',
    })
  }

  if (!opts.force && process.stdin.isTTY) {
    const confirmed = await confirm({
      message: `Remove profile '${name}'? This cannot be undone.`,
    })
    if (isCancel(confirmed) || !confirmed) {
      return
    }
  }

  await removeProfile(name)
  emitInfo(`mxs: profile '${name}' removed`, out)
}
