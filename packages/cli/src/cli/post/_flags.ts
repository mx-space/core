import { Effect, Option } from 'effect'
import { Flag } from 'effect/cli'

import type { Generic, ValidationFailed } from '../../domain/errors'
import type { ContentFormat, PostFlagInputs } from '../../domain/payload'
import { Resolver } from '../../services/Resolver'

// ---------------------------------------------------------------------------
// Shared option definitions for `post create | edit | update`.
// ---------------------------------------------------------------------------

const optional = <A>(self: Flag.Flag<A>) => Flag.optional(self)
const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const title = optional(Flag.String('title'))
export const slug = optional(Flag.String('slug'))
export const category = optional(Flag.String('category'))
export const content = optional(Flag.String('content'))
export const summary = optional(Flag.String('summary'))
export const file = optional(Flag.String('file'))
export const meta = optional(Flag.String('meta'))
export const pin = optional(Flag.String('pin'))

export const format = Flag.Literals('format', ['lexical', 'markdown']).pipe(
  Flag.optional,
)
export const state = Flag.Literals('state', ['publish', 'draft']).pipe(
  Flag.optional,
)

export const tags = optional(Flag.String('tags'))
export const related = optional(Flag.String('related'))
export const pinOrder = optional(Flag.Int('pin-order'))
export const copyright = optional(Flag.String('copyright'))

export const openFlag = Flag.Boolean('open').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'After success, open the admin edit page in the default browser.',
  ),
)
export const silentFlag = Flag.Boolean('silent').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'On success, emit a minimal `ok` instead of the full server response (saves output tokens). Errors still print normally.',
  ),
)

const parseCsv = (v: string | undefined): string[] | undefined => {
  if (v === undefined) return undefined
  const parts = v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return parts
}

const parseCopyright = (v: string | undefined): boolean | undefined =>
  v === undefined ? undefined : v === 'true'

export const postWriteOptions = {
  title,
  slug,
  category,
  content,
  format,
  summary,
  state,
  tags,
  copyright,
  pin,
  pinOrder,
  related,
  meta,
  file,
  open: openFlag,
  silent: silentFlag,
}

export type PostWriteOptionsParsed = {
  readonly title: Option.Option<string>
  readonly slug: Option.Option<string>
  readonly category: Option.Option<string>
  readonly content: Option.Option<string>
  readonly format: Option.Option<ContentFormat>
  readonly summary: Option.Option<string>
  readonly state: Option.Option<'publish' | 'draft'>
  readonly tags: Option.Option<string>
  readonly copyright: Option.Option<string>
  readonly pin: Option.Option<string>
  readonly pinOrder: Option.Option<number>
  readonly related: Option.Option<string>
  readonly meta: Option.Option<string>
  readonly file: Option.Option<string>
  readonly open: boolean
  readonly silent: boolean
}

/** Resolve `__categoryName` placeholder (set by `buildPostPayload`) → `categoryId`. */
export const resolveCategoryRefs = (
  payload: Record<string, unknown>,
): Effect.Effect<
  Record<string, unknown>,
  ValidationFailed | Generic,
  Resolver
> =>
  Effect.gen(function* () {
    const next = { ...payload }
    const nameRef = next.__categoryName
    delete next.__categoryName
    if (typeof nameRef === 'string' && nameRef.length > 0 && !next.categoryId) {
      const resolver = yield* Resolver
      next.categoryId = yield* resolver.resolveCategory(nameRef)
    }
    return next
  })

export const toPostFlagInputs = (
  opts: PostWriteOptionsParsed,
): PostFlagInputs => ({
  title: unwrap(opts.title),
  slug: unwrap(opts.slug),
  category: unwrap(opts.category),
  content: unwrap(opts.content),
  format: unwrap(opts.format),
  summary: unwrap(opts.summary),
  state: unwrap(opts.state),
  tags: parseCsv(unwrap(opts.tags)),
  copyright: parseCopyright(unwrap(opts.copyright)),
  pin: unwrap(opts.pin),
  pinOrder: unwrap(opts.pinOrder),
  related: parseCsv(unwrap(opts.related)),
  meta: unwrap(opts.meta),
  file: unwrap(opts.file),
})

/**
 * Extract the id from a server response — handles both `id` and `_id`,
 * and unwraps the outer `data` envelope mx-core wraps single-object
 * responses with (so `--open` works after `post create`).
 */
export const extractId = (res: unknown): string | undefined => {
  if (!res || typeof res !== 'object') return undefined
  const r = res as Record<string, unknown>
  if (typeof r.id === 'string') return r.id
  if (typeof r._id === 'string') return r._id
  if (r.data && typeof r.data === 'object') return extractId(r.data)
  return undefined
}
