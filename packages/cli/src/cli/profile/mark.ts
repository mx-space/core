import { Args, Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { ValidationFailed } from '../../domain/errors'
import { Profile } from '../../services/Profile'
import { Renderer } from '../../services/Renderer'

const name = Args.text({ name: 'name' })
const production = Options.boolean('production', {
  negationNames: ['no-production'],
}).pipe(Options.optional)

export const mark = Command.make(
  'mark',
  { name, production },
  ({ name, production }) =>
    Effect.gen(function* () {
      const profile = yield* Profile
      const renderer = yield* Renderer

      yield* profile.validateName(name)

      if (Option.isNone(production)) {
        return yield* Effect.fail(
          new ValidationFailed({
            message: 'one of --production or --no-production is required',
          }),
        )
      }

      const value = production.value
      yield* profile.mark(name, { production: value })

      const flag = value ? '--production' : '--no-production'
      yield* renderer.emitInfo(`mxs: profile '${name}' marked with ${flag}`)
    }),
)
