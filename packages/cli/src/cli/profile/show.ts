import { Args, Command } from '@effect/cli'
import { Effect, Option } from 'effect'

import { ProfileNoneActive } from '../../domain/errors'
import { Config } from '../../services/Config'
import { Profile } from '../../services/Profile'
import { Renderer } from '../../services/Renderer'

const nameArg = Args.text({ name: 'name' }).pipe(Args.optional)

export const show = Command.make('show', { name: nameArg }, ({ name }) =>
  Effect.gen(function* () {
    const profile = yield* Profile
    const config = yield* Config
    const renderer = yield* Renderer

    let target = Option.getOrElse(name, () => '')
    if (!target) {
      const current = yield* profile.current
      if (!current) {
        return yield* Effect.fail(
          new ProfileNoneActive({
            message: 'no profile specified and no active profile',
            hint: 'run `mxs profile use <name>` or pass a profile name',
          }),
        )
      }
      target = current
    }

    yield* profile.validateName(target)
    // Profile.show emits ProfileNotFound when the profile dir is missing.
    yield* profile.show(target)

    const cfg = yield* config.readProfileConfig(target)
    const creds = yield* config.readProfileCredentials(target)

    const expiresAt = creds?.expires_at ?? null
    const expiresHuman =
      expiresAt !== null ? new Date(expiresAt).toISOString() : null

    yield* renderer.emitProfileShow({
      name: target,
      api_url: cfg.api_url ?? null,
      production: cfg.production ?? false,
      user: creds?.user ?? null,
      expires_at: expiresAt,
      expires_at_human: expiresHuman,
      authenticated: creds !== null,
    })
  }),
)
