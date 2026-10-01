import { Effect, Option } from 'effect'
import { Flag } from 'effect/cli'

import type { Generic, ValidationFailed } from '../../domain/errors'
import type { ContentFormat, NoteFlagInputs } from '../../domain/payload'
import { Resolver } from '../../services/Resolver'

const optional = <A>(self: Flag.Flag<A>) => Flag.optional(self)
const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const title = optional(Flag.String('title'))
export const slug = optional(Flag.String('slug'))
export const topic = optional(Flag.String('topic'))
export const content = optional(Flag.String('content'))
export const mood = optional(Flag.String('mood'))
export const weather = optional(Flag.String('weather'))
export const publicAt = optional(Flag.String('public-at'))
export const password = optional(Flag.String('password'))
export const coords = optional(Flag.String('coords'))
export const location = optional(Flag.String('location'))
export const images = optional(Flag.String('images'))
export const meta = optional(Flag.String('meta'))
export const file = optional(Flag.String('file'))
export const bookmark = optional(Flag.String('bookmark'))

export const format = Flag.Literals('format', ['lexical', 'markdown']).pipe(
  Flag.optional,
)
export const state = Flag.Literals('state', ['publish', 'draft']).pipe(
  Flag.optional,
)
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

export const noteWriteOptions = {
  title,
  slug,
  topic,
  content,
  format,
  state,
  mood,
  weather,
  publicAt,
  password,
  bookmark,
  coords,
  location,
  images,
  meta,
  file,
  open: openFlag,
  silent: silentFlag,
}

export type NoteWriteOptionsParsed = {
  readonly title: Option.Option<string>
  readonly slug: Option.Option<string>
  readonly topic: Option.Option<string>
  readonly content: Option.Option<string>
  readonly format: Option.Option<ContentFormat>
  readonly state: Option.Option<'publish' | 'draft'>
  readonly mood: Option.Option<string>
  readonly weather: Option.Option<string>
  readonly publicAt: Option.Option<string>
  readonly password: Option.Option<string>
  readonly bookmark: Option.Option<string>
  readonly coords: Option.Option<string>
  readonly location: Option.Option<string>
  readonly images: Option.Option<string>
  readonly meta: Option.Option<string>
  readonly file: Option.Option<string>
  readonly open: boolean
  readonly silent: boolean
}

const parseBoolean = (v: string | undefined): boolean | undefined =>
  v === undefined ? undefined : v === 'true'

export const toNoteFlagInputs = (
  opts: NoteWriteOptionsParsed,
): NoteFlagInputs => ({
  title: unwrap(opts.title),
  slug: unwrap(opts.slug),
  topic: unwrap(opts.topic),
  content: unwrap(opts.content),
  format: unwrap(opts.format),
  state: unwrap(opts.state),
  mood: unwrap(opts.mood),
  weather: unwrap(opts.weather),
  publicAt: unwrap(opts.publicAt),
  password: unwrap(opts.password),
  bookmark: parseBoolean(unwrap(opts.bookmark)),
  coords: unwrap(opts.coords),
  location: unwrap(opts.location),
  images: unwrap(opts.images),
  meta: unwrap(opts.meta),
  file: unwrap(opts.file),
})

/** Resolve `__topicName` placeholder → `topicId`. */
export const resolveTopicRefs = (
  payload: Record<string, unknown>,
): Effect.Effect<
  Record<string, unknown>,
  ValidationFailed | Generic,
  Resolver
> =>
  Effect.gen(function* () {
    const next = { ...payload }
    const nameRef = next.__topicName
    delete next.__topicName
    if (typeof nameRef === 'string' && nameRef.length > 0 && !next.topicId) {
      const resolver = yield* Resolver
      next.topicId = yield* resolver.resolveTopic(nameRef)
    }
    return next
  })
