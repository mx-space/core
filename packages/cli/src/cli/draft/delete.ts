import { Args, Command, Options } from '@effect/cli'
import { Effect } from 'effect'

import { ValidationFailed } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const id = Args.text({ name: 'id' })
const force = Options.boolean('force')

export const del = Command.make('delete', { id, force }, ({ id, force }) =>
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
    yield* api.request(`/drafts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    yield* renderer.emitSuccess({ deleted: id })
  }),
).pipe(Command.withDescription('delete a draft'))
