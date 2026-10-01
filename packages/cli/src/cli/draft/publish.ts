import { Effect, Option } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'

import { openAdminDraftEdit } from '../../domain/admin-link'
import { Generic } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { openFlag, silentFlag } from '../post/_flags'
import {
  normalizeDraftRow,
  parseAiResourcesFlag,
  publishSavedDraft,
  REF_TYPE_TO_RESOURCE,
} from './_shared'

const id = Argument.String('id')
const ai = Flag.String('ai').pipe(
  Flag.withDescription(
    'AI resources to generate, e.g. summary:sync,insights:async,translation (sync waits before going live; a bare name is async).',
  ),
  Flag.optional,
)

export const publish = Command.make(
  'publish',
  { ai, id, open: openFlag, silent: silentFlag },
  ({ ai, id, open, silent }) =>
    Effect.gen(function* () {
      const aiResources = yield* Effect.try({
        try: () => parseAiResourcesFlag(Option.getOrElse(ai, () => '')),
        catch: (error) => new Generic({ message: (error as Error).message }),
      })
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

      const res = yield* publishSavedDraft(api, draft, aiResources)

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
