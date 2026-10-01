import { Effect, Option } from 'effect'
import { Command, Flag } from 'effect/cli'

import { Ai } from '../../../../services/Ai'
import { Renderer } from '../../../../services/Renderer'

const page = Flag.Int('page').pipe(Flag.optional)
const size = Flag.Int('size').pipe(Flag.optional)
const keyPath = Flag.String('key-path').pipe(Flag.optional)
const lang = Flag.String('lang').pipe(Flag.optional)

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
