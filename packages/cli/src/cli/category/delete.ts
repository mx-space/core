import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'

import { ValidationFailed } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'

const slugOrId = Argument.String('slugOrId')
const force = Flag.Boolean('force').pipe(Flag.withDefault(false))

export const del = Command.make(
  'delete',
  { slugOrId, force },
  ({ slugOrId, force }) =>
    Effect.gen(function* () {
      if (!force && !process.stdin.isTTY) {
        return yield* Effect.fail(
          new ValidationFailed({
            message: 'refusing to delete without --force in non-TTY context',
          }),
        )
      }
      const api = yield* Api
      const renderer = yield* Renderer
      const resolver = yield* Resolver
      const id = yield* resolver.resolveCategoryId(slugOrId)
      yield* api.request(`/categories/${id}`, { method: 'DELETE' })
      yield* renderer.emitSuccess({ deleted: id })
    }),
)
