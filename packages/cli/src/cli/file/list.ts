import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { typeOption } from './_shared'

export const list = Command.make('list', { type: typeOption }, ({ type }) =>
  Effect.gen(function* () {
    const api = yield* Api
    const renderer = yield* Renderer
    const res = yield* api.request(`/objects/${type}`)
    yield* renderer.emitSuccess(res)
  }),
).pipe(
  Command.withDescription('list uploaded files of a type (name, url, created)'),
)
