import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { ResourceNotFound } from '../../domain/errors'
import { buildPagePayload } from '../../domain/payload'
import { Api, type ApiService } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { isSnowflakeId } from '../../services/Resolver'
import { pageWriteOptions, toPageFlagInputs } from './create'

const slugOrId = Args.text({ name: 'slugOrId' })

const resolvePageId = (
  api: ApiService,
  ref: string,
): Effect.Effect<string, ResourceNotFound> =>
  Effect.gen(function* () {
    if (isSnowflakeId(ref)) return ref
    const res = yield* api
      .request<{
        id?: string
        data?: { id?: string }
      }>(`/pages/slug/${encodeURIComponent(ref)}`)
      .pipe(Effect.catchAll(() => Effect.succeed(null)))
    const id =
      (res && (res as { id?: string }).id) ??
      (res && (res as { data?: { id?: string } }).data?.id)
    if (!id) {
      return yield* Effect.fail(
        new ResourceNotFound({
          kind: 'page',
          ref,
          message: `page not found: ${ref}`,
        }),
      )
    }
    return id
  })

export const update = Command.make(
  'update',
  { slugOrId, ...pageWriteOptions },
  ({ slugOrId, ...rest }) =>
    Effect.gen(function* () {
      const flags = toPageFlagInputs(rest)
      const built = yield* buildPagePayload(flags)
      // PATCH: only include content if explicitly provided via flag or file.
      const body = { ...built.payload }
      if (flags.content === undefined && !flags.file) {
        delete body.content
        delete body.text
        delete body.contentFormat
      }
      const api = yield* Api
      const renderer = yield* Renderer
      const id = yield* resolvePageId(api, slugOrId)
      const res = yield* api.request(`/pages/${id}`, {
        method: 'PATCH',
        body,
      })
      yield* renderer.emitSuccess(res)
    }),
)
