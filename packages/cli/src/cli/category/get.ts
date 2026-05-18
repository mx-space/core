import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const slugOrId = Args.text({ name: 'slugOrId' })

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
