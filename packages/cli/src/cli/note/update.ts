import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { openAdminDraftEdit } from '../../domain/admin-link'
import { buildNotePayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'
import {
  normalizeData,
  publishSavedDraft,
  saveDraftPayload,
} from '../draft/_shared'
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
      delete payload.isPublished
      const resolved = yield* resolveTopicRefs(payload)
      const resolver = yield* Resolver
      const id = yield* resolver.resolveNoteId(slugOrId)
      const api = yield* Api
      const renderer = yield* Renderer
      const current =
        flags.state === undefined
          ? normalizeData<{ isPublished?: boolean }>(
              yield* api.request(`/notes/${id}`),
            )
          : null
      const saved = yield* saveDraftPayload(api, 'note', resolved, id)
      const response =
        flags.state === 'publish' || current?.isPublished
          ? yield* publishSavedDraft(api, saved.draft)
          : saved.response
      yield* renderer.emitSuccess(rest.silent ? { ok: true } : response)
      if (rest.open && saved.draft.id) {
        yield* openAdminDraftEdit('notes', saved.draft.id, id)
      }
    }),
).pipe(
  Command.withDescription(
    'save changes through the note draft; published notes create an online update job',
  ),
)
