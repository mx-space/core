import open from 'open'

import {
  pollDeviceToken,
  requestDeviceCode,
  toCredentials,
} from '../../core/auth'
import { emitInfo, emitSuccess, type OutputOptions } from '../../core/output'
import {
  getCurrentProfile,
  readProfileConfig,
  setCurrentProfile,
  writeProfileConfig,
  writeProfileCredentials,
} from '../../core/profile'
import { type GlobalFlags, resolveContext } from '../internal/shared'

export interface LoginOpts {
  production?: boolean
}

export async function run(
  flags: GlobalFlags,
  out: OutputOptions,
  opts: LoginOpts = {},
) {
  const ctx = await resolveContext(flags, out)
  emitInfo(`probing ${ctx.apiUrl}…`, out)
  emitInfo(`API base: ${ctx.apiBase}`, out)

  const code = await requestDeviceCode(ctx.authBase, ctx.clientId)
  emitInfo(`visit: ${code.verification_uri}`, out)
  emitInfo(`code:  ${code.user_code}`, out)
  emitInfo(`expires in ${code.expires_in}s`, out)

  if (out.json) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        data: {
          verification_uri: code.verification_uri,
          verification_uri_complete: code.verification_uri_complete,
          user_code: code.user_code,
          expires_in: code.expires_in,
          interval: code.interval,
        },
      })}\n`,
    )
  } else if (!flags.quiet && code.verification_uri_complete) {
    void open(code.verification_uri_complete).catch(() => undefined)
  }

  const token = await pollDeviceToken(
    ctx.authBase,
    ctx.clientId,
    code.device_code,
    {
      intervalSec: code.interval,
      expiresInSec: code.expires_in,
      onTick: (state) => {
        if (state === 'slow_down')
          emitInfo('slow_down — increasing interval', out)
      },
    },
  )
  const cred = toCredentials(token)

  // Determine target profile per spec §3:
  // 1. --profile flag
  // 2. resolved profile, including the virtual dev default profile
  // 3. active current profile
  // 4. fresh install → 'default'
  const target =
    flags.profile?.trim() ||
    ctx.profileName ||
    (await getCurrentProfile()) ||
    'default'

  const existing = await readProfileConfig(target)
  await writeProfileConfig(target, {
    ...existing,
    api_url: ctx.apiUrl,
    api_version: ctx.apiVersion,
    ...(opts.production !== undefined
      ? { production: opts.production }
      : existing.production !== undefined
        ? { production: existing.production }
        : {}),
  })
  await writeProfileCredentials(target, cred)
  await setCurrentProfile(target)

  emitInfo(`mxs: logged in to profile '${target}'`, out)
  emitSuccess(
    {
      user: cred.user ?? null,
      expires_at: cred.expires_at,
    },
    out,
  )
}
