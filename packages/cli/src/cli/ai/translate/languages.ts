import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'
import { Resolver } from '../../../services/Resolver'
import { resolveArticleId } from '../_resolve'

const id = Args.text({ name: 'idOrSlug' })

export const languages = Command.make('languages', { id }, ({ id }) =>
  Effect.gen(function* () {
    const ai = yield* Ai
    const renderer = yield* Renderer
    const resolver = yield* Resolver
    const refId = yield* resolveArticleId(resolver, id)
    const res = yield* ai.getTranslationLanguages(refId)
    yield* renderer.emitSuccess(res)
  }),
).pipe(
  Command.withDescription('list languages an article has been translated into'),
)
