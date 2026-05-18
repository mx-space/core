import { Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const name = Options.text('name')
const slug = Options.text('slug')
const type_ = Options.choice('type', ['category', 'tag'] as const).pipe(
  Options.optional,
)
const icon = Options.text('icon').pipe(Options.optional)

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
