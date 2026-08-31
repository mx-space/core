import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { openAdminDraftEdit } from '../../domain/admin-link'
import { Generic } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { openFlag, silentFlag } from '../post/_flags'
import {
  normalizeDraftRow,
  publishSavedDraft,
  REF_TYPE_TO_RESOURCE,
} from './_shared'

const id = Args.text({ name: 'id' })

export const publish = Command.make(
  'publish',
  { id, open: openFlag, silent: silentFlag },
  ({ id, open, silent }) =>
    Effect.gen(function* () {
      const api = yield* Api
      const renderer = yield* Renderer
      const draft = normalizeDraftRow(
        yield* api.request(`/drafts/${encodeURIComponent(id)}`),
      )
      if (!draft) {
        return yield* Effect.fail(
          new Generic({ message: `draft not found: ${id}` }),
        )
      }
      const resource = REF_TYPE_TO_RESOURCE[draft.document.refType]
      if (!resource) {
        return yield* Effect.fail(
          new Generic({
            message: `unsupported draft refType: ${draft.document.refType}`,
          }),
        )
      }

      const res = yield* publishSavedDraft(api, draft)

      yield* renderer.emitSuccess(silent ? { ok: true } : res)
      if (open) {
        yield* openAdminDraftEdit(
          resource as 'notes' | 'pages' | 'posts',
          draft.id,
          draft.document.refId ?? undefined,
        )
      }
    }),
).pipe(
  Command.withDescription(
    'publish the current head revision of one draft branch',
  ),
)
