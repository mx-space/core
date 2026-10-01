import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'

import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'
import { Resolver } from '../../../services/Resolver'
import { followTask } from '../_poll'
import { resolveArticleId } from '../_resolve'
import { aiTaskView } from '../views'

const id = Argument.String('idOrSlug')
const to = Flag.String('to').pipe(
  Flag.atLeast(0),
  Flag.withDescription(
    'language to translate the insights into once generated (repeatable)',
  ),
)
const force = Flag.Boolean('force').pipe(
  Flag.withDefault(false),
  Flag.withDescription('regenerate even when an up-to-date result exists'),
)
const noWait = Flag.Boolean('no-wait').pipe(
  Flag.withDefault(false),
  Flag.withDescription('return immediately after creating the task'),
)

export const refresh = Command.make(
  'refresh',
  { id, to, force, noWait },
  ({ id, to, force, noWait }) =>
    Effect.gen(function* () {
      const ai = yield* Ai
      const renderer = yield* Renderer
      const resolver = yield* Resolver
      const refId = yield* resolveArticleId(resolver, id)
      const created = yield* ai.refreshInsights({
        refId,
        targetLanguages: to.length ? to : undefined,
        force,
      })
      const final = yield* followTask(ai, renderer, created, noWait)
      yield* renderer.emit(aiTaskView, final)
    }),
).pipe(Command.withDescription('refresh AI insights for an article'))
