import { Args, Command, Options } from '@effect/cli'
import { Effect } from 'effect'

import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'
import { Resolver } from '../../../services/Resolver'
import { followTask } from '../_poll'
import { resolveArticleId } from '../_resolve'
import { aiTaskView } from '../views'

const id = Args.text({ name: 'idOrSlug' })
const noWait = Options.boolean('no-wait').pipe(
  Options.withDescription('return immediately after creating the task'),
)

export const refresh = Command.make(
  'refresh',
  { id, noWait },
  ({ id, noWait }) =>
    Effect.gen(function* () {
      const ai = yield* Ai
      const renderer = yield* Renderer
      const resolver = yield* Resolver
      const refId = yield* resolveArticleId(resolver, id)
      const created = yield* ai.refreshInsights({ refId })
      const final = yield* followTask(ai, renderer, created, noWait)
      yield* renderer.emit(aiTaskView, final)
    }),
).pipe(Command.withDescription('refresh AI insights for an article'))
