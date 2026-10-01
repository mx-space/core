import { Effect, Option } from 'effect'
import { Command, Flag } from 'effect/cli'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { projectListView } from './view'

const page = Flag.Int('page').pipe(Flag.optional)
const size = Flag.Int('size').pipe(Flag.optional)

const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const list = Command.make('list', { page, size }, ({ page, size }) =>
  Effect.gen(function* () {
    const api = yield* Api
    const renderer = yield* Renderer
    const res = yield* api.request('/projects', {
      query: {
        page: unwrap(page),
        size: unwrap(size),
      },
    })
    yield* renderer.emit(projectListView, res)
  }),
).pipe(Command.withDescription('list projects'))
