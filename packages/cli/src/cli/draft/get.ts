import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const id = Args.text({ name: 'id' })

export const get = Command.make('get', { id }, ({ id }) =>
  Effect.gen(function* () {
    const api = yield* Api
    const renderer = yield* Renderer
    const res = yield* api.request(`/drafts/${encodeURIComponent(id)}`)
    yield* renderer.emitSuccess(res)
  }),
).pipe(Command.withDescription('show a single draft by id'))
