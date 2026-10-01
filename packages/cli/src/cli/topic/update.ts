import { Effect, Option } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'

import { ResourceNotFound } from '../../domain/errors'
import { Api, type ApiService } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { isSnowflakeId } from '../../services/Resolver'

const slugOrId = Argument.String('slugOrId')
const name = Flag.String('name').pipe(Flag.optional)
const slug = Flag.String('slug').pipe(Flag.optional)
const description = Flag.String('description').pipe(Flag.optional)
const icon = Flag.String('icon').pipe(Flag.optional)

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
      .pipe(Effect.catch(() => Effect.succeed(null)))
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

export const update = Command.make(
  'update',
  { slugOrId, name, slug, description, icon },
  ({ slugOrId, name, slug, description, icon }) =>
    Effect.gen(function* () {
      const body: Record<string, unknown> = {}
      const n = Option.getOrUndefined(name)
      if (n) body.name = n
      const s = Option.getOrUndefined(slug)
      if (s) body.slug = s
      const d = Option.getOrUndefined(description)
      if (d) body.description = d
      const ic = Option.getOrUndefined(icon)
      if (ic) body.icon = ic

      const api = yield* Api
      const renderer = yield* Renderer
      const id = yield* resolveTopicId(api, slugOrId)
      const res = yield* api.request(`/topics/${id}`, {
        method: 'PATCH',
        body,
      })
      yield* renderer.emitSuccess(res)
    }),
)
