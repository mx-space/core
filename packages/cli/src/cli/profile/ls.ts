import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { Config, type ConfigShape } from '../../services/Config'
import { Profile } from '../../services/Profile'
import { Renderer } from '../../services/Renderer'

export const ls = Command.make('ls', {}, () =>
  Effect.gen(function* () {
    const profile = yield* Profile
    const config = yield* Config
    const renderer = yield* Renderer

    const names = yield* profile.list
    const current = yield* profile.current

    const rows: Array<{
      readonly current: string
      readonly name: string
      readonly api_url: string
      readonly production: string
    }> = []
    for (const name of names) {
      const cfg = yield* config
        .readProfileConfig(name)
        .pipe(Effect.catchAll(() => Effect.succeed({} as ConfigShape)))
      rows.push({
        current: name === current ? '*' : '',
        name,
        api_url: cfg.api_url ?? '',
        production: cfg.production ? 'yes' : 'no',
      })
    }

    yield* renderer.emitProfileList(rows)
  }),
)
