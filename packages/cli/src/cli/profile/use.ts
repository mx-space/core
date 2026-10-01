import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'

import { Profile } from '../../services/Profile'
import { Renderer } from '../../services/Renderer'

const name = Argument.String('name')

export const use = Command.make('use', { name }, ({ name }) =>
  Effect.gen(function* () {
    const profile = yield* Profile
    const renderer = yield* Renderer

    yield* profile.use(name)
    yield* renderer.emitInfo(`mxs: active profile is now '${name}'`)
  }),
)
