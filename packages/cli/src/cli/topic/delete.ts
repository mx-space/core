import { Args, Command, Options } from '@effect/cli'
import { Effect } from 'effect'

import { ResourceNotFound, ValidationFailed } from '../../domain/errors'
import { Api, type ApiService } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { isSnowflakeId } from '../../services/Resolver'

const slugOrId = Args.text({ name: 'slugOrId' })
const force = Options.boolean('force')

const resolveTopicId = (
  api: ApiService,
  ref: string,
): Effect.Effect<string, ResourceNotFound> =>
  Effect.gen(function* () {
    if (isSnowflakeId(ref)) return ref
    const res = yield* api
      .request<{
        id?: string
        data?: { id?: string }
      }>(`/topics/slug/${encodeURIComponent(ref)}`)
      .pipe(Effect.catchAll(() => Effect.succeed(null)))
    const id =
      (res && (res as { id?: string }).id) ??
      (res && (res as { data?: { id?: string } }).data?.id)
    if (!id) {
      return yield* Effect.fail(
        new ResourceNotFound({
          kind: 'topic',
          ref,
          message: `topic not found: ${ref}`,
        }),
      )
    }
    return id
  })

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
      const id = yield* resolveTopicId(api, slugOrId)
      yield* api.request(`/topics/${id}`, { method: 'DELETE' })
      yield* renderer.emitSuccess({ deleted: id })
    }),
)
