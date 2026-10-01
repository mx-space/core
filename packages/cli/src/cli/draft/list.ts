import { Effect, Option } from 'effect'
import { Command, Flag } from 'effect/cli'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const page = Flag.Int('page').pipe(Flag.optional)
const size = Flag.Int('size').pipe(Flag.optional)
const type = Flag.Literals('type', ['post', 'note', 'page']).pipe(Flag.optional)
const newOnly = Flag.Boolean('new').pipe(
  Flag.withDefault(false),
  Flag.withDescription('only drafts not linked to a published resource'),
)
const linkedOnly = Flag.Boolean('linked').pipe(
  Flag.withDefault(false),
  Flag.withDescription('only drafts linked to a published resource'),
)

const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const list = Command.make(
  'list',
  { page, size, type, new: newOnly, linked: linkedOnly },
  ({ page, size, type, new: newOnly, linked: linkedOnly }) =>
    Effect.gen(function* () {
      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request('/drafts', {
        query: {
          page: unwrap(page),
          size: unwrap(size),
          refType: unwrap(type),
          hasRef: newOnly ? false : linkedOnly ? true : undefined,
        },
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('list drafts'))
