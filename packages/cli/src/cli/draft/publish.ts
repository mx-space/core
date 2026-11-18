import { Effect, Option } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'

import { openAdminDraftEdit } from '../../domain/admin-link'
import { Generic, ValidationFailed } from '../../domain/errors'
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
    'AI resources to generate, e.g. summary:sync,insights:async,translation (sync waits before going live; a bare name is async). Omit to reuse the last publish choices; "none" generates nothing.',
  ),
  Flag.optional,
)
const expectedHead = Flag.String('expected-head').pipe(
  Flag.withDescription(
    'refuse if the draft head differs from this revision id',
  ),
  Flag.optional,
)
const expectedPublished = Flag.String('expected-published').pipe(
  Flag.withDescription(
    'refuse if the published revision differs from this id; use "none" for a new draft',
  ),
  Flag.optional,
)

export const publish = Command.make(
  'publish',
  {
    ai,
    expectedHead,
    expectedPublished,
    id,
    open: openFlag,
    silent: silentFlag,
  },
  ({ ai, expectedHead, expectedPublished, id, open, silent }) =>
    Effect.gen(function* () {
      const aiResources = yield* Effect.try({
        try: () => Option.getOrUndefined(Option.map(ai, parseAiResourcesFlag)),
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
      if (
        Option.isSome(expectedHead) &&
        draft.headRevisionId !== expectedHead.value
      ) {
        return yield* Effect.fail(
          new ValidationFailed({
            message: `draft head changed: expected ${expectedHead.value}, found ${draft.headRevisionId}`,
          }),
        )
      }
      const publishedRevision = draft.document.publishedRevisionId ?? 'none'
      if (
        Option.isSome(expectedPublished) &&
        publishedRevision !== expectedPublished.value
      ) {
        return yield* Effect.fail(
          new ValidationFailed({
            message: `published revision changed: expected ${expectedPublished.value}, found ${publishedRevision}`,
          }),
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
