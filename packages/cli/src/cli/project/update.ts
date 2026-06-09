import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { openAdminEdit } from '../../domain/admin-link'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'
import {
  buildProjectPayload,
  projectWriteOptions,
  toProjectFlagInputs,
} from './_flags'

const nameOrId = Args.text({ name: 'nameOrId' })

export const update = Command.make(
  'update',
  { nameOrId, ...projectWriteOptions },
  ({ nameOrId, ...rest }) =>
    Effect.gen(function* () {
      const flags = toProjectFlagInputs(rest)
      const payload = yield* buildProjectPayload(flags)
      const resolver = yield* Resolver
      const id = yield* resolver.resolveProjectId(nameOrId)
      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request(`/projects/${id}`, {
        method: 'PATCH',
        body: payload,
      })
      yield* resolver.invalidate('project')
      yield* renderer.emitSuccess(rest.silent ? { ok: true } : res)
      if (rest.open) yield* openAdminEdit('projects', id)
    }),
).pipe(Command.withDescription('partially update a project'))
