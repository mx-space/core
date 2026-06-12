import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { resolveSnippetId } from './_resolve'

const target = Args.text({ name: 'idOrRefName' })

export const get = Command.make('get', { target }, ({ target }) =>
  Effect.gen(function* () {
    const api = yield* Api
    const renderer = yield* Renderer
    const id = yield* resolveSnippetId(api, target)
    const res = yield* api.request(`/snippets/${id}`)
    yield* renderer.emitSuccess(res)
  }),
).pipe(Command.withDescription('get a snippet by id or reference/name'))
