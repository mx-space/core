import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'
import { Resolver } from '../../../services/Resolver'
import { resolveArticleId } from '../_resolve'

const id = Args.text({ name: 'idOrSlug' })

export const byArticle = Command.make('by-article', { id }, ({ id }) =>
  Effect.gen(function* () {
    const ai = yield* Ai
    const renderer = yield* Renderer
    const resolver = yield* Resolver
    const refId = yield* resolveArticleId(resolver, id)
    const res = yield* ai.getOverviewByArticle(refId)
    yield* renderer.emitSuccess(res)
  }),
).pipe(
  Command.withDescription('show the AI artifact overview for one article'),
)
