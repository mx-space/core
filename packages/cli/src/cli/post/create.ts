import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { buildPostPayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import {
  postWriteOptions,
  resolveCategoryRefs,
  toPostFlagInputs,
} from './_flags'

export const create = Command.make('create', postWriteOptions, (opts) =>
  Effect.gen(function* () {
    const flags = toPostFlagInputs(opts)
    const built = yield* buildPostPayload(flags)
    const payload = yield* resolveCategoryRefs(built.payload)
    const api = yield* Api
    const renderer = yield* Renderer
    const res = yield* api.request('/posts', {
      method: 'POST',
      body: payload,
    })
    yield* renderer.emitSuccess(res)
  }),
).pipe(Command.withDescription('create a post'))
