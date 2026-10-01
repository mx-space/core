import { Effect, Option } from 'effect'
import { Command, Flag } from 'effect/cli'

import { openAdminDraftEdit } from '../../domain/admin-link'
import type { PageFlagInputs } from '../../domain/payload'
import { buildPagePayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { saveDraftPayload } from '../draft/_shared'

const title = Flag.optional(Flag.String('title'))
const slug = Flag.optional(Flag.String('slug'))
const subtitle = Flag.optional(Flag.String('subtitle'))
const order = Flag.optional(Flag.Int('order'))
const content = Flag.optional(Flag.String('content'))
const format = Flag.Literals('format', ['lexical', 'markdown']).pipe(
  Flag.optional,
)
const meta = Flag.optional(Flag.String('meta'))
const file = Flag.optional(Flag.String('file'))
const openFlag = Flag.Boolean('open').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'After success, open the admin edit page in the default browser.',
  ),
)
const silentFlag = Flag.Boolean('silent').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'On success, emit a minimal `ok` instead of the full server response (saves output tokens). Errors still print normally.',
  ),
)

export const pageWriteOptions = {
  title,
  slug,
  subtitle,
  order,
  content,
  format,
  meta,
  file,
  open: openFlag,
  silent: silentFlag,
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
  readonly open: boolean
  readonly silent: boolean
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
    const saved = yield* saveDraftPayload(api, 'page', built.payload)
    yield* renderer.emitSuccess(opts.silent ? { ok: true } : saved.response)
    if (opts.open && saved.draft.id) {
      yield* openAdminDraftEdit('pages', saved.draft.id)
    }
  }),
).pipe(Command.withDescription('create a page draft'))
