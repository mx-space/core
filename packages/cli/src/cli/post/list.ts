import { Effect, Option } from 'effect'
import { Command, Flag } from 'effect/cli'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { postListView } from './view'

const page = Flag.Int('page').pipe(Flag.optional)
const size = Flag.Int('size').pipe(Flag.optional)
const state = Flag.Literals('state', ['publish', 'draft']).pipe(Flag.optional)
const sort = Flag.Literals('sort', ['created', 'modified']).pipe(Flag.optional)

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
      yield* renderer.emit(postListView, res)
    }),
).pipe(Command.withDescription('list posts'))
