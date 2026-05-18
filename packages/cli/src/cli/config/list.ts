import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

export const list = Command.make('list', {}, () =>
  Effect.gen(function* () {
    const api = yield* Api
    const renderer = yield* Renderer
    const res = yield* api.request('/options')
    yield* renderer.emitSuccess(res)
  }),
)
