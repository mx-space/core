import { Args, Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'
import { Resolver } from '../../../services/Resolver'
import { resolveArticleId } from '../_resolve'

const id = Args.text({ name: 'idOrSlug' })
const lang = Options.text('lang').pipe(Options.optional)
const onlyDb = Options.boolean('only-db').pipe(
  Options.withDescription('do not auto-generate on miss'),
)

const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const byArticle = Command.make(
  'by-article',
  { id, lang, onlyDb },
  ({ id, lang, onlyDb }) =>
    Effect.gen(function* () {
      const ai = yield* Ai
      const renderer = yield* Renderer
      const resolver = yield* Resolver
      const refId = yield* resolveArticleId(resolver, id)
      const res = yield* ai.getSummariesByArticle(refId, {
        lang: unwrap(lang),
        onlyDb,
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription("show an article's AI summary"))
