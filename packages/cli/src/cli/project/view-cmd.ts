import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'
import { projectView } from './view'

const nameOrId = Args.text({ name: 'nameOrId' })

export const viewCmd = Command.make('view', { nameOrId }, ({ nameOrId }) =>
  Effect.gen(function* () {
    const api = yield* Api
    const renderer = yield* Renderer
    const resolver = yield* Resolver
    const id = yield* resolver.resolveProjectId(nameOrId)
    const res = yield* api.request(`/projects/${id}`)
    yield* renderer.emit(projectView, res)
  }),
).pipe(Command.withDescription('show a project (rendered)'))
