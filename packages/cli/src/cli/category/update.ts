import { Effect, Option } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'

const slugOrId = Argument.String('slugOrId')
const name = Flag.String('name').pipe(Flag.optional)
const slug = Flag.String('slug').pipe(Flag.optional)
const type_ = Flag.Literals('type', ['category', 'tag'] as const).pipe(
  Flag.optional,
)
const icon = Flag.String('icon').pipe(Flag.optional)

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
