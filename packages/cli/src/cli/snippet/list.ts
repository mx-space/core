import { Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const page = Options.integer('page').pipe(Options.optional)
const size = Options.integer('size').pipe(Options.optional)
const grouped = Options.boolean('grouped')

const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const list = Command.make(
  'list',
  { page, size, grouped },
  ({ page, size, grouped }) =>
    Effect.gen(function* () {
      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request(
        grouped ? '/snippets/group' : '/snippets',
        {
          query: {
            page: unwrap(page),
            size: unwrap(size),
          },
        },
      )
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('list snippets'))
