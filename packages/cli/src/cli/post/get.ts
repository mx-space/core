import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'
import { postView } from './view'

const slugOrId = Argument.String('slugOrId')

export const get = Command.make('get', { slugOrId }, ({ slugOrId }) =>
  Effect.gen(function* () {
    const api = yield* Api
    const renderer = yield* Renderer
    const resolver = yield* Resolver
    const path = yield* resolver.resolvePostReadPath(slugOrId)
    const res = yield* api.request(path, { query: { prefer: 'lexical' } })
    yield* renderer.emit(postView, res)
  }),
).pipe(Command.withDescription('get a post by slug or id'))
