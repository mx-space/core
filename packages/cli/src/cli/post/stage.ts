import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { ValidationFailed } from '../../domain/errors'
import { buildPostPayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'
import { saveDraftPayload } from '../draft/_shared'
import {
  postWriteOptions,
  resolveCategoryRefs,
  toPostFlagInputs,
} from './_flags'

const slugOrId = Args.text({ name: 'slugOrId' })

export const stage = Command.make(
  'stage',
  { slugOrId, ...postWriteOptions },
  ({ slugOrId, ...rest }) =>
    Effect.gen(function* () {
      const flags = toPostFlagInputs(rest)
      const built = yield* buildPostPayload(flags)
      const payload = yield* resolveCategoryRefs({ ...built.payload })
      // Publish state never travels through staging: it would otherwise ride
      // into `typeSpecificData` and unpublish the live post on `post apply`.
      delete payload.isPublished
      // `contentFormat` is always defaulted by the payload builder; require
      // some actual change beyond it so an empty stage fails loudly.
      const changedKeys = Object.keys(payload).filter(
        (k) => k !== 'contentFormat',
      )
      if (changedKeys.length === 0) {
        return yield* Effect.fail(
          new ValidationFailed({
            message: 'nothing to stage: provide --file or content/meta flags',
          }),
        )
      }

      const resolver = yield* Resolver
      const id = yield* resolver.resolvePostId(slugOrId)
      const api = yield* Api
      const renderer = yield* Renderer
      const { response } = yield* saveDraftPayload(api, 'post', payload, id)
      yield* renderer.emitSuccess(rest.silent ? { ok: true } : response)
    }),
).pipe(
  Command.withDescription(
    'stage changes as a draft attached to a published post (the live post is untouched until `post apply`)',
  ),
)
