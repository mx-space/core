import { Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import type { Generic, ValidationFailed } from '../../domain/errors'
import type { ContentFormat, NoteFlagInputs } from '../../domain/payload'
import { Resolver } from '../../services/Resolver'

const optional = <A>(self: Options.Options<A>) => Options.optional(self)
const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const title = optional(Options.text('title'))
export const slug = optional(Options.text('slug'))
export const topic = optional(Options.text('topic'))
export const content = optional(Options.text('content'))
export const mood = optional(Options.text('mood'))
export const weather = optional(Options.text('weather'))
export const publicAt = optional(Options.text('public-at'))
export const password = optional(Options.text('password'))
export const coords = optional(Options.text('coords'))
export const location = optional(Options.text('location'))
export const images = optional(Options.text('images'))
export const meta = optional(Options.text('meta'))
export const file = optional(Options.text('file'))
export const bookmark = optional(Options.text('bookmark'))

export const format = Options.choice('format', ['lexical', 'markdown']).pipe(
  Options.optional,
)
export const state = Options.choice('state', ['publish', 'draft']).pipe(
  Options.optional,
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
