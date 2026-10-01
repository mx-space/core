import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'

import { ValidationFailed } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { typeOption } from './_shared'

const name = Argument.String('name')
const force = Flag.Boolean('force').pipe(
  Flag.withDefault(false),
  Flag.withDescription('skip confirmation'),
)

export const del = Command.make(
  'delete',
  { name, type: typeOption, force },
  ({ name, type, force }) =>
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
      yield* api.request(`/objects/${type}/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      })
      yield* renderer.emitSuccess({ deleted: `${type}/${name}` })
    }),
).pipe(Command.withDescription('delete an uploaded file'))
