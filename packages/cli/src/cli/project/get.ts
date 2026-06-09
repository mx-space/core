import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'

const nameOrId = Args.text({ name: 'nameOrId' })

export const get = Command.make('get', { nameOrId }, ({ nameOrId }) =>
  Effect.gen(function* () {
    const api = yield* Api
    const renderer = yield* Renderer
    const resolver = yield* Resolver
    const id = yield* resolver.resolveProjectId(nameOrId)
    const res = yield* api.request(`/projects/${id}`)
    yield* renderer.emitSuccess(res)
  }),
).pipe(Command.withDescription('get a project by name or id'))
