import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'

import { ValidationFailed } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { isSnowflakeId } from '../../services/Resolver'

const target = Argument.String('pathOrId')
const force = Flag.Boolean('force').pipe(
  Flag.withDefault(false),
  Flag.withDescription('skip the non-TTY guard'),
)
const recursive = Flag.Boolean('recursive').pipe(Flag.withDefault(false))

export const del = Command.make(
  'rm',
  { target, force, recursive },
  ({ target, force, recursive }) =>
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
      if (isSnowflakeId(target)) {
        yield* api.request(`/snippets/${target}`, { method: 'DELETE' })
      } else {
        yield* api.request('/snippets/by-path', {
          method: 'DELETE',
          query: { path: target, recursive },
        })
      }
      yield* renderer.emitSuccess({ deleted: target })
    }),
).pipe(Command.withDescription('delete a snippet path'))
