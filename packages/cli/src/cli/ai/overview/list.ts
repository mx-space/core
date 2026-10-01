import { Effect, Option } from 'effect'
import { Command, Flag } from 'effect/cli'

import { Ai, type AiOverviewType } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'

const page = Flag.Int('page').pipe(Flag.optional)
const size = Flag.Int('size').pipe(Flag.optional)
const search = Flag.String('search').pipe(
  Flag.optional,
  Flag.withDescription('filter by article title'),
)
const type = Flag.Literals('type', ['post', 'note', 'page'] as const).pipe(
  Flag.optional,
  Flag.withDescription('filter by article type'),
)

const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const list = Command.make(
  'list',
  { page, size, search, type },
  ({ page, size, search, type }) =>
    Effect.gen(function* () {
      const ai = yield* Ai
      const renderer = yield* Renderer
      const res = yield* ai.listOverview({
        page: unwrap(page),
        size: unwrap(size),
        search: unwrap(search),
        type: unwrap(type) as AiOverviewType | undefined,
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(
  Command.withDescription('list the per-article AI overview board (grouped)'),
)
