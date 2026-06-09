import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { openAdminEdit } from '../../domain/admin-link'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'
import {
  buildProjectPayload,
  extractId,
  projectWriteOptions,
  toProjectFlagInputs,
} from './_flags'

export const create = Command.make('create', projectWriteOptions, (opts) =>
  Effect.gen(function* () {
    const flags = toProjectFlagInputs(opts)
    const payload = yield* buildProjectPayload(flags)
    const api = yield* Api
    const renderer = yield* Renderer
    const resolver = yield* Resolver
    const res = yield* api.request('/projects', {
      method: 'POST',
      body: payload,
    })
    yield* resolver.invalidate('project')
    yield* renderer.emitSuccess(opts.silent ? { ok: true } : res)
    if (opts.open) {
      const id = extractId(res)
      if (id) yield* openAdminEdit('projects', id)
    }
  }),
).pipe(Command.withDescription('create a project'))
