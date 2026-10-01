import { Effect } from 'effect'
import { Command, Flag } from 'effect/cli'

import { Ai } from '../../../../services/Ai'
import { Renderer } from '../../../../services/Renderer'

const keyPath = Flag.String('key-path').pipe(
  Flag.atLeast(0),
  Flag.withDescription(
    'restrict to a server-validated key path (repeatable). Allowed: category.name, topic.name, topic.introduce, topic.description, note.mood, note.weather',
  ),
)
const to = Flag.String('to').pipe(
  Flag.atLeast(0),
  Flag.withDescription('target language code (repeatable)'),
)

export const generate = Command.make(
  'generate',
  { keyPath, to },
  ({ keyPath, to }) =>
    Effect.gen(function* () {
      const ai = yield* Ai
      const renderer = yield* Renderer
      const res = yield* ai.generateEntries({
        keyPaths: keyPath.length ? keyPath : undefined,
        targetLangs: to.length ? to : undefined,
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('regenerate translation entries'))
