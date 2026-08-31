import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { openAdminDraftEdit } from '../../domain/admin-link'
import { buildPostPayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'
import {
  normalizeData,
  publishSavedDraft,
  saveDraftPayload,
} from '../draft/_shared'
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
      delete payload.isPublished
      const resolved = yield* resolveCategoryRefs(payload)
      const resolver = yield* Resolver
      const id = yield* resolver.resolvePostId(slugOrId)
      const api = yield* Api
      const renderer = yield* Renderer
      const current =
        flags.state === undefined
          ? normalizeData<{ isPublished?: boolean }>(
              yield* api.request(`/posts/${id}`),
            )
          : null
      const saved = yield* saveDraftPayload(api, 'post', resolved, id)
      const response =
        flags.state === 'publish' || current?.isPublished
          ? yield* publishSavedDraft(api, saved.draft)
          : saved.response
      yield* renderer.emitSuccess(rest.silent ? { ok: true } : response)
      if (rest.open && saved.draft.id) {
        yield* openAdminDraftEdit('posts', saved.draft.id, id)
      }
    }),
).pipe(
  Command.withDescription(
    'save changes through the post draft; published posts create an online update job',
  ),
)
