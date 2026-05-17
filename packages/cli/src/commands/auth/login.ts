import open from 'open'

import {
  pollDeviceToken,
  requestDeviceCode,
  toCredentials,
} from '../../core/auth'
import { writeCredentials } from '../../core/config-store'
import { emitInfo, emitSuccess, type OutputOptions } from '../../core/output'
import { type GlobalFlags, resolveContext } from '../internal/shared'

export async function run(flags: GlobalFlags, out: OutputOptions) {
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
  await writeCredentials(cred)
  emitInfo('authorized', out)
  emitSuccess(
    {
      user: cred.user ?? null,
      expires_at: cred.expires_at,
    },
    out,
  )
}
