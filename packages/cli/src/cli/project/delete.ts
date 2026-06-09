import { Args, Command, Options } from '@effect/cli'
import { Effect } from 'effect'

import { ValidationFailed } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'

const nameOrId = Args.text({ name: 'nameOrId' })
const force = Options.boolean('force').pipe(
  Options.withDescription('skip the non-TTY guard'),
)

export const del = Command.make(
  'delete',
  { nameOrId, force },
  ({ nameOrId, force }) =>
    Effect.gen(function* () {
      if (!force && !process.stdin.isTTY) {
        return yield* Effect.fail(
          new ValidationFailed({
            message: 'refusing to delete without --force in non-TTY context',
          }),
        )
      }
      const resolver = yield* Resolver
      const api = yield* Api
      const renderer = yield* Renderer
      const id = yield* resolver.resolveProjectId(nameOrId)
      yield* api.request(`/projects/${id}`, { method: 'DELETE' })
      yield* resolver.invalidate('project')
      yield* renderer.emitSuccess({ deleted: id })
    }),
).pipe(Command.withDescription('delete a project'))
