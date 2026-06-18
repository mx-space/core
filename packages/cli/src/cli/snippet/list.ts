import { Args, Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const prefix = Args.text({ name: 'prefix' }).pipe(Args.optional)
const limit = Options.integer('limit').pipe(Options.optional)
const recursive = Options.boolean('recursive')

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
