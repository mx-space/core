import { Args, Command, Options } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const from = Args.text({ name: 'from' })
const to = Args.text({ name: 'to' })
const recursive = Options.boolean('recursive')

export const update = Command.make(
  'mv',
  { from, to, recursive },
  ({ from, to, recursive }) =>
    Effect.gen(function* () {
      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request('/snippets/move', {
        method: 'POST',
        body: { from, to, recursive },
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('move or rename a snippet path'))
