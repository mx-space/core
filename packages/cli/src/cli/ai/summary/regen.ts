import { Args, Command, Options } from '@effect/cli'
import { Effect } from 'effect'

import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'
import { Resolver } from '../../../services/Resolver'
import { followTask } from '../_poll'
import { resolveArticleId } from '../_resolve'
import { aiTaskView } from '../views'

const id = Args.text({ name: 'idOrSlug' })
const to = Options.text('to').pipe(
  Options.repeated,
  Options.withDescription('target language code (repeatable)'),
)
const noWait = Options.boolean('no-wait').pipe(
  Options.withDescription('return immediately after creating the task'),
)

export const regen = Command.make(
  'regen',
  { id, to, noWait },
  ({ id, to, noWait }) =>
    Effect.gen(function* () {
      const ai = yield* Ai
      const renderer = yield* Renderer
      const resolver = yield* Resolver
      const refId = yield* resolveArticleId(resolver, id)
      const created = yield* ai.regenSummary({
        refId,
        targetLanguages: to.length ? to : undefined,
      })
      const final = yield* followTask(ai, renderer, created, noWait)
      yield* renderer.emit(aiTaskView, final)
    }),
).pipe(Command.withDescription('regenerate the AI summary for an article'))
