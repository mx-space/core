import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'

const slugOrId = Args.text({ name: 'slugOrId' })

export const publish = Command.make('publish', { slugOrId }, ({ slugOrId }) =>
  Effect.gen(function* () {
    const resolver = yield* Resolver
    const api = yield* Api
    const renderer = yield* Renderer
    const id = yield* resolver.resolveNoteId(slugOrId)
    const res = yield* api.request(`/notes/${id}/publish`, {
      method: 'PATCH',
      body: { isPublished: true },
    })
    yield* renderer.emitSuccess(res)
  }),
).pipe(Command.withDescription('publish a note'))
