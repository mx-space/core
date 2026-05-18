import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { buildNotePayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { noteWriteOptions, resolveTopicRefs, toNoteFlagInputs } from './_flags'

export const create = Command.make('create', noteWriteOptions, (opts) =>
  Effect.gen(function* () {
    const flags = toNoteFlagInputs(opts)
    const built = yield* buildNotePayload(flags)
    const payload = yield* resolveTopicRefs(built.payload)
    const api = yield* Api
    const renderer = yield* Renderer
    const res = yield* api.request('/notes', {
      method: 'POST',
      body: payload,
    })
    yield* renderer.emitSuccess(res)
  }),
).pipe(Command.withDescription('create a note'))
