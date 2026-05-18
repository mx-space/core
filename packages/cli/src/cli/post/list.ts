import { Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const page = Options.integer('page').pipe(Options.optional)
const size = Options.integer('size').pipe(Options.optional)
const state = Options.choice('state', ['publish', 'draft']).pipe(
  Options.optional,
)
const sort = Options.choice('sort', ['created', 'modified']).pipe(
  Options.optional,
)

const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const list = Command.make(
  'list',
  { page, size, state, sort },
  ({ page, size, state, sort }) =>
    Effect.gen(function* () {
      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request('/posts', {
        query: {
          page: unwrap(page),
          size: unwrap(size),
          state: unwrap(state),
          sortBy: unwrap(sort),
        },
      })
      yield* renderer.emitPostList(res)
    }),
).pipe(Command.withDescription('list posts'))
