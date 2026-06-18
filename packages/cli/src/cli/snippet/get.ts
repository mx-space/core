import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { isSnowflakeId } from '../../services/Resolver'

const target = Args.text({ name: 'pathOrId' })

export const get = Command.make('get', { target }, ({ target }) =>
  Effect.gen(function* () {
    const api = yield* Api
    const renderer = yield* Renderer
    const res = yield* api.request(
      isSnowflakeId(target) ? `/snippets/${target}` : '/snippets/by-path',
      isSnowflakeId(target) ? undefined : { query: { path: target } },
    )
    yield* renderer.emitSuccess(res)
  }),
).pipe(Command.withDescription('get a snippet by path or id'))
