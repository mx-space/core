import { Command, Options } from '@effect/cli'
import { Effect } from 'effect'

import { Ai } from '../../../services/Ai'
import { Renderer } from '../../../services/Renderer'

const provider = Options.text('provider').pipe(
  Options.withDescription('AI provider id'),
)
const model = Options.text('model').pipe(
  Options.withDescription('TTS model id'),
)

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
).pipe(
  Command.withDescription('discover TTS voices for a provider/model pair'),
)
