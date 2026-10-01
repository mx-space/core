import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { isSnowflakeId } from '../../services/Resolver'
import { pageView } from './view'

const slugOrId = Argument.String('slugOrId')

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
