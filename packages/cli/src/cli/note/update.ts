import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { openAdminEdit } from '../../domain/admin-link'
import { buildNotePayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'
import { noteWriteOptions, resolveTopicRefs, toNoteFlagInputs } from './_flags'

const slugOrId = Args.text({ name: 'slugOrId' })

export const update = Command.make(
  'update',
  { slugOrId, ...noteWriteOptions },
  ({ slugOrId, ...rest }) =>
    Effect.gen(function* () {
      const flags = toNoteFlagInputs(rest)
      const built = yield* buildNotePayload(flags)
      const payload: Record<string, unknown> = { ...built.payload }
      if (flags.content === undefined && !flags.file) {
        delete payload.content
        delete payload.text
        delete payload.contentFormat
      }
      // Envelope <state> must not flip publish state on update; only the
      // explicit --state flag (or publish/unpublish) changes it. See the same
      // guard in post/update.ts.
      if (flags.state === undefined) delete payload.isPublished
      const resolved = yield* resolveTopicRefs(payload)
      const resolver = yield* Resolver
      const id = yield* resolver.resolveNoteId(slugOrId)
      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request(`/notes/${id}`, {
        method: 'PATCH',
        body: resolved,
      })
      yield* renderer.emitSuccess(rest.silent ? { ok: true } : res)
      if (rest.open) yield* openAdminEdit('notes', id)
    }),
).pipe(Command.withDescription('partially update a note'))
