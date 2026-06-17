import { Args, Command, Options } from '@effect/cli'
import { Effect } from 'effect'

import { ValidationFailed } from '../../../domain/errors'
import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'

const recordId = Args.text({ name: 'recordId' })
const force = Options.boolean('force').pipe(
  Options.withDescription('skip the non-TTY guard'),
)

export const del = Command.make(
  'delete',
  { recordId, force },
  ({ recordId, force }) =>
    Effect.gen(function* () {
      if (!force && !process.stdin.isTTY) {
        return yield* Effect.fail(
          new ValidationFailed({
            message: 'refusing to delete without --force in non-TTY context',
          }),
        )
      }
      const ai = yield* Ai
      const renderer = yield* Renderer
      yield* ai.deleteSummary(recordId)
      yield* renderer.emitSuccess({ deleted: recordId })
    }),
).pipe(Command.withDescription('delete an AI summary'))
