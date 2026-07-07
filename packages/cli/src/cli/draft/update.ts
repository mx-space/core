import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { ValidationFailed } from '../../domain/errors'
import { buildPostPayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import {
  postWriteOptions,
  resolveCategoryRefs,
  toPostFlagInputs,
} from '../post/_flags'
import { splitDraftBody } from './_shared'

const id = Args.text({ name: 'id' })

export const update = Command.make(
  'update',
  { id, ...postWriteOptions },
  ({ id, ...rest }) =>
    Effect.gen(function* () {
      const flags = toPostFlagInputs(rest)
      const built = yield* buildPostPayload(flags)
      const payload = yield* resolveCategoryRefs({ ...built.payload })
      delete payload.isPublished
      const changedKeys = Object.keys(payload).filter(
        (k) => k !== 'contentFormat',
      )
      if (changedKeys.length === 0) {
        return yield* Effect.fail(
          new ValidationFailed({
            message: 'nothing to update: provide --file or content/meta flags',
          }),
        )
      }
      const body = splitDraftBody(payload)

      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request(`/drafts/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body,
      })
      yield* renderer.emitSuccess(rest.silent ? { ok: true, id } : res)
    }),
).pipe(
  Command.withDescription(
    'update a draft (bumps its version and records history on content change)',
  ),
)
