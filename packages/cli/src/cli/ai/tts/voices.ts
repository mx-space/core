import { Effect } from 'effect'
import { Command, Flag } from 'effect/cli'

import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'

const provider = Flag.String('provider').pipe(
  Flag.withDescription('AI provider id'),
)
const model = Flag.String('model').pipe(Flag.withDescription('TTS model id'))

export const voices = Command.make(
  'voices',
  { provider, model },
  ({ provider, model }) =>
    Effect.gen(function* () {
      const ai = yield* Ai
      const renderer = yield* Renderer
      const res = yield* ai.discoverTtsVoices({ providerId: provider, model })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('discover TTS voices for a provider/model pair'))
