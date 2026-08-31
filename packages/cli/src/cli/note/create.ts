import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { openAdminDraftEdit } from '../../domain/admin-link'
import { buildNotePayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { publishSavedDraft, saveDraftPayload } from '../draft/_shared'
import { noteWriteOptions, resolveTopicRefs, toNoteFlagInputs } from './_flags'

export const create = Command.make('create', noteWriteOptions, (opts) =>
  Effect.gen(function* () {
    const flags = toNoteFlagInputs(opts)
    const built = yield* buildNotePayload(flags)
    const payload = yield* resolveTopicRefs({ ...built.payload })
    const shouldPublish = payload.isPublished === true
    delete payload.isPublished
    const api = yield* Api
    const renderer = yield* Renderer
    const saved = yield* saveDraftPayload(api, 'note', payload)
    const response = shouldPublish
      ? yield* publishSavedDraft(api, saved.draft)
      : saved.response
    yield* renderer.emitSuccess(opts.silent ? { ok: true } : response)
    if (opts.open && saved.draft.id) {
      yield* openAdminDraftEdit('notes', saved.draft.id)
    }
  }),
).pipe(
  Command.withDescription(
    'create a note draft; pass --state publish to start first publication',
  ),
)
