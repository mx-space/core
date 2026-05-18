import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { AuthMissing } from '../../domain/errors'
import { Auth } from '../../services/Auth'
import { Config } from '../../services/Config'
import { Profile } from '../../services/Profile'
import { Renderer } from '../../services/Renderer'
import { whoamiView } from './view'

export const whoami = Command.make('whoami', {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth
    const profile = yield* Profile
    const config = yield* Config
    const renderer = yield* Renderer

    const resolved = yield* profile.resolve()
    const cred = resolved.profileName
      ? yield* config.readProfileCredentials(resolved.profileName)
      : null

    if (!cred && !resolved.token && !resolved.apiKey) {
      return yield* Effect.fail(
        new AuthMissing({
          message: 'not authenticated',
          hint: 'run `mxs auth login`',
        }),
      )
    }

    // Refresh credentials when near expiry; on missing/expired surface the
    // failure so the entry-point exits with the right code. On generic
    // refresh failure (e.g. server unreachable) fall back to the cached user.
    const refreshed = yield* auth
      .ensureFresh(resolved)
      .pipe(Effect.catchTag('Generic', () => Effect.succeed(cred)))

    // Backfill user via /get-session when the cached cred lacks it (servers
    // that omit `user` from the device-token response). Best-effort.
    const active = refreshed ?? cred
    const enriched =
      active && !active.user && resolved.profileName
        ? yield* auth
            .enrichUser(resolved.profileName, resolved.authBase, active)
            .pipe(Effect.catchAll(() => Effect.succeed(active)))
        : active

    yield* renderer.emit(whoamiView, {
      user: enriched?.user ?? null,
      api_url: resolved.apiUrl,
      profile: resolved.profileName,
      expires_at:
        (enriched as { expires_at?: number } | null)?.expires_at ?? null,
    })
  }),
)
