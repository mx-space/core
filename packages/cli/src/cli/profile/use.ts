import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Profile } from '../../services/Profile'
import { Renderer } from '../../services/Renderer'

const name = Args.text({ name: 'name' })

export const use = Command.make('use', { name }, ({ name }) =>
  Effect.gen(function* () {
    const profile = yield* Profile
    const renderer = yield* Renderer

    yield* profile.use(name)
    yield* renderer.emitInfo(`mxs: active profile is now '${name}'`)
  }),
)
