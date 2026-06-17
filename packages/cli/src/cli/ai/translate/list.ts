import { Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'

const page = Options.integer('page').pipe(Options.optional)
const size = Options.integer('size').pipe(Options.optional)

const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const list = Command.make('list', { page, size }, ({ page, size }) =>
  Effect.gen(function* () {
    const ai = yield* Ai
    const renderer = yield* Renderer
    const res = yield* ai.listTranslations({
      page: unwrap(page),
      size: unwrap(size),
      grouped: true,
    })
    yield* renderer.emitSuccess(res)
  }),
).pipe(Command.withDescription('list AI translations (grouped by article)'))
