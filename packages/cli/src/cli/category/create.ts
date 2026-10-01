import { Effect, Option } from 'effect'
import { Command, Flag } from 'effect/cli'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const name = Flag.String('name')
const slug = Flag.String('slug')
const type_ = Flag.Literals('type', ['category', 'tag'] as const).pipe(
  Flag.optional,
)
const icon = Flag.String('icon').pipe(Flag.optional)

export const create = Command.make(
  'create',
  { name, slug, type: type_, icon },
  ({ name, slug, type, icon }) =>
    Effect.gen(function* () {
      const body: Record<string, unknown> = { name, slug }
      const t = Option.getOrUndefined(type)
      if (t) body.type = t === 'tag' ? 1 : 0
      const ic = Option.getOrUndefined(icon)
      if (ic) body.icon = ic
      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request('/categories', {
        method: 'POST',
        body,
      })
      yield* renderer.emitSuccess(res)
    }),
)
