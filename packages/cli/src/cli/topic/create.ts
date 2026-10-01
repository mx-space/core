import { Effect, Option } from 'effect'
import { Command, Flag } from 'effect/cli'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const name = Flag.String('name')
const slug = Flag.String('slug')
const description = Flag.String('description').pipe(Flag.optional)
const icon = Flag.String('icon').pipe(Flag.optional)

export const create = Command.make(
  'create',
  { name, slug, description, icon },
  ({ name, slug, description, icon }) =>
    Effect.gen(function* () {
      const body: Record<string, unknown> = { name, slug }
      const d = Option.getOrUndefined(description)
      if (d) body.description = d
      const ic = Option.getOrUndefined(icon)
      if (ic) body.icon = ic
      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request('/topics', {
        method: 'POST',
        body,
      })
      yield* renderer.emitSuccess(res)
    }),
)
