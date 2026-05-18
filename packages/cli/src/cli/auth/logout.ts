import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { ProfileNoneActive } from '../../domain/errors'
import { Auth } from '../../services/Auth'
import { Config } from '../../services/Config'
import { Renderer } from '../../services/Renderer'

export const logout = Command.make('logout', {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth
    const config = yield* Config
    const renderer = yield* Renderer

    const target = yield* config.readCurrent
    if (!target) {
      return yield* Effect.fail(
        new ProfileNoneActive({
          message: 'no active profile to log out of',
          hint: 'pass --profile <name> or set an active profile with `mxs profile use <name>`',
        }),
      )
    }

    yield* auth.logout(target)
    yield* renderer.emitInfo(`mxs: logged out of profile '${target}'`)
    yield* renderer.emitSuccess({ ok: true })
  }),
)
