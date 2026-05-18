import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const key = Args.text({ name: 'key' })

export const get = Command.make('get', { key }, ({ key }) =>
  Effect.gen(function* () {
    const api = yield* Api
    const renderer = yield* Renderer
    const res = yield* api.request(`/options/${encodeURIComponent(key)}`)
    yield* renderer.emitSuccess(res)
  }),
)
