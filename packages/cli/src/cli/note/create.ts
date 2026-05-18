import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { openAdminEdit } from '../../domain/admin-link'
import { buildNotePayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { extractId } from '../post/_flags'
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
    yield* renderer.emitSuccess(opts.silent ? { ok: true } : res)
    if (opts.open) {
      const id = extractId(res)
      if (id) yield* openAdminEdit('notes', id)
    }
  }),
).pipe(Command.withDescription('create a note'))
