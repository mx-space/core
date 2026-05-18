import { Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const page = Options.integer('page').pipe(Options.optional)
const size = Options.integer('size').pipe(Options.optional)
const state = Options.text('state').pipe(Options.optional)
const sort = Options.text('sort').pipe(Options.optional)

const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const list = Command.make(
  'list',
  { page, size, state, sort },
  ({ page, size, sort }) =>
    Effect.gen(function* () {
      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request('/notes', {
        query: {
          page: unwrap(page),
          size: unwrap(size),
          sortBy: unwrap(sort),
        },
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('list notes'))
