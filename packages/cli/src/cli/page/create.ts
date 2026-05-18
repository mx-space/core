import { Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import type { PageFlagInputs } from '../../domain/payload'
import { buildPagePayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const title = Options.optional(Options.text('title'))
const slug = Options.optional(Options.text('slug'))
const subtitle = Options.optional(Options.text('subtitle'))
const order = Options.optional(Options.integer('order'))
const content = Options.optional(Options.text('content'))
const format = Options.choice('format', ['lexical', 'markdown']).pipe(
  Options.optional,
)
const meta = Options.optional(Options.text('meta'))
const file = Options.optional(Options.text('file'))

export const pageWriteOptions = {
  title,
  slug,
  subtitle,
  order,
  content,
  format,
  meta,
  file,
}

const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const toPageFlagInputs = (opts: {
  readonly title: Option.Option<string>
  readonly slug: Option.Option<string>
  readonly subtitle: Option.Option<string>
  readonly order: Option.Option<number>
  readonly content: Option.Option<string>
  readonly format: Option.Option<'lexical' | 'markdown'>
  readonly meta: Option.Option<string>
  readonly file: Option.Option<string>
}): PageFlagInputs => ({
  title: unwrap(opts.title),
  slug: unwrap(opts.slug),
  subtitle: unwrap(opts.subtitle),
  order: unwrap(opts.order),
  content: unwrap(opts.content),
  format: unwrap(opts.format),
  meta: unwrap(opts.meta),
  file: unwrap(opts.file),
})

export const create = Command.make('create', pageWriteOptions, (opts) =>
  Effect.gen(function* () {
    const flags = toPageFlagInputs(opts)
    const built = yield* buildPagePayload(flags)
    const api = yield* Api
    const renderer = yield* Renderer
    const res = yield* api.request('/pages', {
      method: 'POST',
      body: built.payload,
    })
    yield* renderer.emitSuccess(res)
  }),
)
