import { Args, Command, Options } from '@effect/cli'
import { Effect } from 'effect'

import { ValidationFailed } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { resolveSnippetId } from './_resolve'

const target = Args.text({ name: 'idOrRefName' })
const force = Options.boolean('force').pipe(
  Options.withDescription('skip the non-TTY guard'),
)

export const del = Command.make(
  'delete',
  { target, force },
  ({ target, force }) =>
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
      const id = yield* resolveSnippetId(api, target)
      yield* api.request(`/snippets/${id}`, { method: 'DELETE' })
      yield* renderer.emitSuccess({ deleted: id })
    }),
).pipe(Command.withDescription('delete a snippet'))
