import { Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'

const page = Options.integer('page').pipe(Options.optional)
const size = Options.integer('size').pipe(Options.optional)
const grouped = Options.boolean('grouped').pipe(
  Options.withDescription('group rows by article'),
)
const search = Options.text('search').pipe(
  Options.optional,
  Options.withDescription('filter by article title (grouped mode)'),
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
      const res = yield* ai.listTts({
        page: unwrap(page),
        size: unwrap(size),
        grouped,
        search: unwrap(search),
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('list AI narrations'))
