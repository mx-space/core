import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { isSnowflakeId } from '../../services/Resolver'
import { pageView } from './view'

const slugOrId = Args.text({ name: 'slugOrId' })

export const get = Command.make('get', { slugOrId }, ({ slugOrId }) =>
  Effect.gen(function* () {
    const api = yield* Api
    const renderer = yield* Renderer
    const path = isSnowflakeId(slugOrId)
      ? `/pages/${slugOrId}`
      : `/pages/slug/${encodeURIComponent(slugOrId)}`
    const res = yield* api.request(path, { query: { prefer: 'lexical' } })
    yield* renderer.emit(pageView, res)
  }),
)
