import { Args, Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'

const slugOrId = Args.text({ name: 'slugOrId' })
const name = Options.text('name').pipe(Options.optional)
const slug = Options.text('slug').pipe(Options.optional)
const type_ = Options.choice('type', ['category', 'tag'] as const).pipe(
  Options.optional,
)
const icon = Options.text('icon').pipe(Options.optional)

export const update = Command.make(
  'update',
  { slugOrId, name, slug, type: type_, icon },
  ({ slugOrId, name, slug, type, icon }) =>
    Effect.gen(function* () {
      const body: Record<string, unknown> = {}
      const n = Option.getOrUndefined(name)
      if (n) body.name = n
      const s = Option.getOrUndefined(slug)
      if (s) body.slug = s
      const t = Option.getOrUndefined(type)
      if (t) body.type = t === 'tag' ? 1 : 0
      const ic = Option.getOrUndefined(icon)
      if (ic) body.icon = ic

      const api = yield* Api
      const renderer = yield* Renderer
      const resolver = yield* Resolver
      const id = yield* resolver.resolveCategoryId(slugOrId)
      const res = yield* api.request(`/categories/${id}`, {
        method: 'PATCH',
        body,
      })
      yield* renderer.emitSuccess(res)
    }),
)
