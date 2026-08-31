import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { openAdminDraftEdit } from '../../domain/admin-link'
import { buildPostPayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { publishSavedDraft, saveDraftPayload } from '../draft/_shared'
import {
  postWriteOptions,
  resolveCategoryRefs,
  toPostFlagInputs,
} from './_flags'

export const create = Command.make('create', postWriteOptions, (opts) =>
  Effect.gen(function* () {
    const flags = toPostFlagInputs(opts)
    const built = yield* buildPostPayload(flags)
    const payload = yield* resolveCategoryRefs({ ...built.payload })
    const shouldPublish = payload.isPublished === true
    delete payload.isPublished
    const api = yield* Api
    const renderer = yield* Renderer
    const saved = yield* saveDraftPayload(api, 'post', payload)
    const response = shouldPublish
      ? yield* publishSavedDraft(api, saved.draft)
      : saved.response
    yield* renderer.emitSuccess(opts.silent ? { ok: true } : response)
    if (opts.open && saved.draft.id) {
      yield* openAdminDraftEdit('posts', saved.draft.id)
    }
  }),
).pipe(
  Command.withDescription(
    'create a post draft; pass --state publish to start first publication',
  ),
)
