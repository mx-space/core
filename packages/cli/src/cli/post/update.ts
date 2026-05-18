import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { buildPostPayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'
import {
  postWriteOptions,
  resolveCategoryRefs,
  toPostFlagInputs,
} from './_flags'

const slugOrId = Args.text({ name: 'slugOrId' })

export const update = Command.make(
  'update',
  { slugOrId, ...postWriteOptions },
  ({ slugOrId, ...rest }) =>
    Effect.gen(function* () {
      const flags = toPostFlagInputs(rest)
      const built = yield* buildPostPayload(flags)
      const payload: Record<string, unknown> = { ...built.payload }
      if (flags.content === undefined && !flags.file) {
        delete payload.content
        delete payload.text
        delete payload.contentFormat
      }
      const resolved = yield* resolveCategoryRefs(payload)
      const resolver = yield* Resolver
      const id = yield* resolver.resolvePostId(slugOrId)
      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request(`/posts/${id}`, {
        method: 'PATCH',
        body: resolved,
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('partially update a post'))
