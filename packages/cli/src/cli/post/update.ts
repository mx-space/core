import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { openAdminEdit } from '../../domain/admin-link'
import { buildPostPayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'
import {
  postWriteOptions,
  resolveCategoryRefs,
  toPostFlagInputs,
} from './_flags'

const slugOrId = Args.text({ name: 'slugOrId' })

export const update = Command.make(
  'update',
  { slugOrId, ...postWriteOptions },
  ({ slugOrId, ...rest }) =>
    Effect.gen(function* () {
      const flags = toPostFlagInputs(rest)
      const built = yield* buildPostPayload(flags)
      const payload: Record<string, unknown> = { ...built.payload }
      if (flags.content === undefined && !flags.file) {
        delete payload.content
        delete payload.text
        delete payload.contentFormat
      }
      // Envelope <state> must not flip publish state on update: envelopes are
      // routinely reused from `post create` (where <state>draft</state> is the
      // norm), and a published post silently reverting to draft makes it
      // vanish for readers. Only the explicit --state flag (or the dedicated
      // publish/unpublish commands) changes publish state.
      if (flags.state === undefined) delete payload.isPublished
      const resolved = yield* resolveCategoryRefs(payload)
      const resolver = yield* Resolver
      const id = yield* resolver.resolvePostId(slugOrId)
      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request(`/posts/${id}`, {
        method: 'PATCH',
        body: resolved,
      })
      yield* renderer.emitSuccess(rest.silent ? { ok: true } : res)
      if (rest.open) yield* openAdminEdit('posts', id)
    }),
).pipe(Command.withDescription('partially update a post'))
