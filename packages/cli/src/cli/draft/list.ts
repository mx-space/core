import { Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const page = Options.integer('page').pipe(Options.optional)
const size = Options.integer('size').pipe(Options.optional)
const type = Options.choice('type', ['post', 'note', 'page']).pipe(
  Options.optional,
)
const newOnly = Options.boolean('new').pipe(
  Options.withDescription('only drafts not linked to a published resource'),
)
const linkedOnly = Options.boolean('linked').pipe(
  Options.withDescription('only drafts linked to a published resource'),
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
