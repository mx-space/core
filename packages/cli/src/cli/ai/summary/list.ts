import { Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'

const page = Options.integer('page').pipe(Options.optional)
const size = Options.integer('size').pipe(Options.optional)
const grouped = Options.boolean('grouped').pipe(
  Options.withDescription('group rows by article'),
)

const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const list = Command.make(
  'list',
  { page, size, grouped },
  ({ page, size, grouped }) =>
    Effect.gen(function* () {
      const ai = yield* Ai
      const renderer = yield* Renderer
      const res = yield* ai.listSummaries({
        page: unwrap(page),
        size: unwrap(size),
        grouped,
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('list AI summaries'))
