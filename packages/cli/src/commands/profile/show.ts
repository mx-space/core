import { promises as fs } from 'node:fs'

import { MxsError } from '../../core/errors'
import { emitSuccess, type OutputOptions } from '../../core/output'
import {
  getCurrentProfile,
  getProfileDir,
  readProfileConfig,
  readProfileCredentials,
  validateProfileName,
} from '../../core/profile'
import type { GlobalFlags } from '../internal/shared'

export async function run(
  nameArg: string | undefined,
  _flags: GlobalFlags,
  out: OutputOptions,
) {
  let name = nameArg
  if (!name) {
    name = (await getCurrentProfile()) ?? undefined
  }
  if (!name) {
    throw new MxsError({
      code: 'profile.none_active',
      message: 'no profile specified and no active profile',
      hint: 'run `mxs profile use <name>` or pass a profile name',
    })
  }

  validateProfileName(name)

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

  const [cfg, creds] = await Promise.all([
    readProfileConfig(name),
    readProfileCredentials(name),
  ])

  const expiresAt = creds?.expires_at ?? null
  const expiresHuman =
    expiresAt !== null ? new Date(expiresAt).toISOString() : null

  const data = {
    name,
    api_url: cfg.api_url ?? null,
    production: cfg.production ?? false,
    user: creds?.user ?? null,
    expires_at: expiresAt,
    expires_at_human: expiresHuman,
    authenticated: creds !== null,
  }

  emitSuccess(data, out)
}
