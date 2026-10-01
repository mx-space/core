import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'

import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'

const recordId = Argument.String('recordId')

export const get = Command.make('get', { recordId }, ({ recordId }) =>
  Effect.gen(function* () {
    const ai = yield* Ai
    const renderer = yield* Renderer
    const res = yield* ai.getInsights(recordId)
    yield* renderer.emitSuccess(res)
  }),
).pipe(Command.withDescription('get AI insights by record id'))
