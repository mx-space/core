import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const slugOrId = Argument.String('slugOrId')

export const get = Command.make('get', { slugOrId }, ({ slugOrId }) =>
  Effect.gen(function* () {
    const api = yield* Api
    const renderer = yield* Renderer
    const res = yield* api.request(
      `/categories/${encodeURIComponent(slugOrId)}`,
    )
    yield* renderer.emitSuccess(res)
  }),
)
