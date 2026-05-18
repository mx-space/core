import { Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const name = Options.text('name')
const slug = Options.text('slug')
const description = Options.text('description').pipe(Options.optional)
const icon = Options.text('icon').pipe(Options.optional)

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
