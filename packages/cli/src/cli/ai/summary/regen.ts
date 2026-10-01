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
  Flag.withDescription('target language code (repeatable)'),
)
const force = Flag.Boolean('force').pipe(
  Flag.withDefault(false),
  Flag.withDescription('regenerate even when an up-to-date result exists'),
)
const noWait = Flag.Boolean('no-wait').pipe(
  Flag.withDefault(false),
  Flag.withDescription('return immediately after creating the task'),
)

export const regen = Command.make(
  'regen',
  { id, to, force, noWait },
  ({ id, to, force, noWait }) =>
    Effect.gen(function* () {
      const ai = yield* Ai
      const renderer = yield* Renderer
      const resolver = yield* Resolver
      const refId = yield* resolveArticleId(resolver, id)
      const created = yield* ai.regenSummary({
        refId,
        targetLanguages: to.length ? to : undefined,
        force,
      })
      const final = yield* followTask(ai, renderer, created, noWait)
      yield* renderer.emit(aiTaskView, final)
    }),
).pipe(Command.withDescription('regenerate the AI summary for an article'))
