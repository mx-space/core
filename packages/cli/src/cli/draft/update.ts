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
import { normalizeDraftRow, splitDraftBody } from './_shared'

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
      const current = normalizeDraftRow(
        yield* api.request(`/drafts/${encodeURIComponent(id)}`),
      )
      if (!current) {
        return yield* Effect.fail(
          new ValidationFailed({ message: `draft not found: ${id}` }),
        )
      }
      const res = yield* api.request(`/drafts/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: {
          data: {
            ...current.headRevision,
            ...body,
            typeSpecificData: {
              ...current.headRevision.typeSpecificData,
              ...(body.typeSpecificData as Record<string, unknown>),
            },
          },
          expectedHeadRevisionId: current.headRevisionId,
        },
      })
      yield* renderer.emitSuccess(rest.silent ? { ok: true, id } : res)
    }),
).pipe(Command.withDescription('append a revision to one draft branch'))
