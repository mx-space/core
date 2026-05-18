import { promises as fs } from 'node:fs'

import { MxsError } from '../../core/errors'
import { emitInfo, type OutputOptions } from '../../core/output'
import {
  getProfileDir,
  readProfileConfig,
  validateProfileName,
  writeProfileConfig,
} from '../../core/profile'
import type { GlobalFlags } from '../internal/shared'

export interface MarkOpts {
  production?: boolean
}

export async function run(
  name: string,
  opts: MarkOpts,
  _flags: GlobalFlags,
  out: OutputOptions,
) {
  validateProfileName(name)

  if (opts.production === undefined) {
    throw new MxsError({
      code: 'validation.failed',
      message: 'one of --production or --no-production is required',
    })
  }

  try {
    const stat = await fs.stat(getProfileDir(name))
    if (!stat.isDirectory()) throw new Error('not a directory')
  } catch (err: any) {
    if (err?.code !== 'ENOENT' && !(err instanceof MxsError)) throw err
    throw new MxsError({
      code: 'profile.not_found',
      message: `profile '${name}' does not exist`,
    })
  }

  const existing = await readProfileConfig(name)
  await writeProfileConfig(name, { ...existing, production: opts.production })

  const flag = opts.production ? '--production' : '--no-production'
  emitInfo(`mxs: profile '${name}' marked with ${flag}`, out)
}
