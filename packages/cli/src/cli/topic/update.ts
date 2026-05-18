import { Args, Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { ResourceNotFound } from '../../domain/errors'
import { Api, type ApiService } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { isSnowflakeId } from '../../services/Resolver'

const slugOrId = Args.text({ name: 'slugOrId' })
const name = Options.text('name').pipe(Options.optional)
const slug = Options.text('slug').pipe(Options.optional)
const description = Options.text('description').pipe(Options.optional)
const icon = Options.text('icon').pipe(Options.optional)

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
