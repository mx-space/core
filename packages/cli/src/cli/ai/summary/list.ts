import { Effect, Option } from 'effect'
import { Command, Flag } from 'effect/cli'

import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'

const page = Flag.Int('page').pipe(Flag.optional)
const size = Flag.Int('size').pipe(Flag.optional)
const grouped = Flag.Boolean('grouped').pipe(
  Flag.withDefault(false),
  Flag.withDescription('group rows by article'),
)
const search = Flag.String('search').pipe(
  Flag.optional,
  Flag.withDescription('filter by article title (grouped mode)'),
)

const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const list = Command.make(
  'list',
  { page, size, grouped, search },
  ({ page, size, grouped, search }) =>
    Effect.gen(function* () {
      const ai = yield* Ai
      const renderer = yield* Renderer
      const res = yield* ai.listSummaries({
        page: unwrap(page),
        size: unwrap(size),
        grouped,
        search: unwrap(search),
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('list AI summaries'))
