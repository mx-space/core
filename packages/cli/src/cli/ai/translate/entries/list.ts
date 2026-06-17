import { Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Ai } from '../../../../services/Ai'
import { Renderer } from '../../../../services/Renderer'

const page = Options.integer('page').pipe(Options.optional)
const size = Options.integer('size').pipe(Options.optional)
const keyPath = Options.text('key-path').pipe(Options.optional)
const lang = Options.text('lang').pipe(Options.optional)

const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const list = Command.make(
  'list',
  { page, size, keyPath, lang },
  ({ page, size, keyPath, lang }) =>
    Effect.gen(function* () {
      const ai = yield* Ai
      const renderer = yield* Renderer
      const res = yield* ai.listEntries({
        page: unwrap(page),
        size: unwrap(size),
        keyPath: unwrap(keyPath),
        lang: unwrap(lang),
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('list AI translation entries (i18n dictionary)'))
