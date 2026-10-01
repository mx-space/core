import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'

import { ValidationFailed } from '../../../domain/errors'
import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'

const recordId = Argument.String('recordId')
const force = Flag.Boolean('force').pipe(
  Flag.withDefault(false),
  Flag.withDescription('skip the non-TTY guard'),
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
      yield* ai.deleteTts(recordId)
      yield* renderer.emitSuccess({ deleted: recordId })
    }),
).pipe(Command.withDescription('delete an AI narration record'))
