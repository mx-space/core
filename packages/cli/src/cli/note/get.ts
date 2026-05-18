import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { ValidationFailed } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { isSnowflakeId } from '../../services/Resolver'

const slugOrId = Args.text({ name: 'slugOrId' })

export const get = Command.make('get', { slugOrId }, ({ slugOrId }) =>
  Effect.gen(function* () {
    const api = yield* Api
    const renderer = yield* Renderer
    if (isSnowflakeId(slugOrId)) {
      const res = yield* api.request(`/notes/${slugOrId}`, {
        query: { prefer: 'lexical' },
      })
      yield* renderer.emitDocument('note', res)
      return
    }
    if (/^\d+$/.test(slugOrId)) {
      const res = yield* api.request(`/notes/nid/${slugOrId}`, {
        query: { single: '1', prefer: 'lexical' },
      })
      yield* renderer.emitDocument('note', res)
      return
    }
    return yield* Effect.fail(
      new ValidationFailed({
        message: `invalid note reference: ${slugOrId} (use snowflake id or numeric nid)`,
      }),
    )
  }),
).pipe(Command.withDescription('get a note by snowflake id or numeric nid'))
