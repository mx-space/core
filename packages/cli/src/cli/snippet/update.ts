import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const from = Argument.String('from')
const to = Argument.String('to')
const recursive = Flag.Boolean('recursive').pipe(Flag.withDefault(false))

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
