import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'

const slugOrId = Args.text({ name: 'slugOrId' })

export const unpublish = Command.make(
  'unpublish',
  { slugOrId },
  ({ slugOrId }) =>
    Effect.gen(function* () {
      const resolver = yield* Resolver
      const api = yield* Api
      const renderer = yield* Renderer
      const id = yield* resolver.resolvePostId(slugOrId)
      const res = yield* api.request(`/posts/${id}`, {
        method: 'PATCH',
        body: { isPublished: false },
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('unpublish a post'))
