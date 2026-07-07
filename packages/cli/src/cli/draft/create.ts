import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { openAdminDraftEdit } from '../../domain/admin-link'
import { ValidationFailed } from '../../domain/errors'
import { buildPostPayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import {
  extractId,
  postWriteOptions,
  resolveCategoryRefs,
  toPostFlagInputs,
} from '../post/_flags'
import { splitDraftBody } from './_shared'

export const create = Command.make('create', postWriteOptions, (opts) =>
  Effect.gen(function* () {
    const flags = toPostFlagInputs(opts)
    const built = yield* buildPostPayload(flags)
    const payload = yield* resolveCategoryRefs({ ...built.payload })
    // Drafts have no publish state; it is decided at `draft publish`.
    delete payload.isPublished
    const changedKeys = Object.keys(payload).filter(
      (k) => k !== 'contentFormat',
    )
    if (changedKeys.length === 0) {
      return yield* Effect.fail(
        new ValidationFailed({
          message: 'nothing to save: provide --file or content/meta flags',
        }),
      )
    }
    const body = splitDraftBody(payload)

    const api = yield* Api
    const renderer = yield* Renderer
    const res = yield* api.request('/drafts', {
      method: 'POST',
      body: { refType: 'post', ...body },
    })
    const id = extractId(res)
    yield* renderer.emitSuccess(opts.silent ? { ok: true, id } : res)
    if (opts.open && id) {
      yield* openAdminDraftEdit('posts', id)
    }
  }),
).pipe(
  Command.withDescription(
    'create a standalone post draft (not linked to any published post; publish later with `draft publish`)',
  ),
)
