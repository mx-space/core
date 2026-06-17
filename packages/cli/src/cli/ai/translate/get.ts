import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'

const recordId = Args.text({ name: 'recordId' })

export const get = Command.make('get', { recordId }, ({ recordId }) =>
  Effect.gen(function* () {
    const ai = yield* Ai
    const renderer = yield* Renderer
    const res = yield* ai.getTranslation(recordId)
    yield* renderer.emitSuccess(res)
  }),
).pipe(Command.withDescription('get an AI translation by record id'))
