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
  Options.withDescription('target language code (single)'),
)
const force = Options.boolean('force').pipe(
  Options.withDescription('retranslate even when an up-to-date result exists'),
)
const noWait = Options.boolean('no-wait').pipe(
  Options.withDescription('return immediately after creating the task'),
)

export const translate = Command.make(
  'translate',
  { id, to, force, noWait },
  ({ id, to, force, noWait }) =>
    Effect.gen(function* () {
      const ai = yield* Ai
      const renderer = yield* Renderer
      const resolver = yield* Resolver
      const refId = yield* resolveArticleId(resolver, id)
      const created = yield* ai.translateInsights({
        refId,
        targetLang: to,
        force,
      })
      const final = yield* followTask(ai, renderer, created, noWait)
      yield* renderer.emit(aiTaskView, final)
    }),
).pipe(
  Command.withDescription(
    'translate the existing AI insights into another language',
  ),
)
