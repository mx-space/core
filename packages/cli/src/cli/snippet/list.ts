import { Effect, Option } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const prefix = Argument.String('prefix').pipe(Argument.optional)
const limit = Flag.Int('limit').pipe(Flag.optional)
const recursive = Flag.Boolean('recursive').pipe(Flag.withDefault(false))

const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const list = Command.make(
  'ls',
  { prefix, limit, recursive },
  ({ prefix, limit, recursive }) =>
    Effect.gen(function* () {
      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request('/snippets', {
        query: {
          prefix: unwrap(prefix),
          limit: unwrap(limit),
          recursive,
        },
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('list snippet VFS paths'))
