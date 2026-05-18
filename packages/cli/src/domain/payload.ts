import type { Path } from '@effect/platform'
import { FileSystem } from '@effect/platform'
import { Effect } from 'effect'

import { Lexical, type LexicalState } from '../services/Lexical'
import { readContentSpec, readJsonSpec, readStdin } from './content-spec'
import {
  coerceMeta,
  type EnvelopeKind,
  type EnvelopeMeta,
  type ParsedEnvelope,
  parseEnvelope,
} from './envelope'
import { ValidationFailed, ValidationXml } from './errors'

export type ContentFormat = 'lexical' | 'markdown'

export interface PostFlagInputs {
  title?: string
  slug?: string
  category?: string
  content?: string
  format?: ContentFormat
  summary?: string
  state?: 'publish' | 'draft'
  tags?: string[]
  copyright?: boolean
  pin?: string
  pinOrder?: number
  related?: string[]
  meta?: string
  file?: string
}

export interface NoteFlagInputs {
  title?: string
  slug?: string
  topic?: string
  content?: string
  format?: ContentFormat
  state?: 'publish' | 'draft'
  mood?: string
  weather?: string
  publicAt?: string
  password?: string
  bookmark?: boolean
  coords?: string
  location?: string
  images?: string
  meta?: string
  file?: string
}

export interface PageFlagInputs {
  title?: string
  slug?: string
  subtitle?: string
  order?: number
  content?: string
  format?: ContentFormat
  meta?: string
  file?: string
}

export interface BuiltPayload {
  readonly payload: Record<string, unknown>
  readonly envelopeMeta?: EnvelopeMeta
  readonly contentSource?: 'flag' | 'envelope' | 'none'
}

const messageOf = (err: unknown): string => {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return String(err)
}

// ---------------------------------------------------------------------------
// Envelope loading
// ---------------------------------------------------------------------------

export const loadEnvelopeIfAny = (
  filePath: string | undefined,
  kind: EnvelopeKind,
): Effect.Effect<
  ParsedEnvelope | null,
  ValidationFailed | ValidationXml,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    if (!filePath) return null
    let xml: string
    if (filePath === '-' || filePath === 'stdin' || filePath === '/dev/stdin') {
      xml = yield* readStdin
    } else if (filePath.startsWith('file=')) {
      const src = yield* readContentSpec(filePath)
      xml = src?.text ?? ''
    } else {
      const fs = yield* FileSystem.FileSystem
      xml = yield* fs.readFileString(filePath).pipe(
        Effect.mapError(
          (err) =>
            new ValidationFailed({
              message: `failed to read ${filePath}: ${messageOf(err)}`,
            }),
        ),
      )
    }
    return yield* parseEnvelopeEffect(xml, kind)
  })

// `parseEnvelope` throws `ValidationXml` — wrap in Effect.try so the error
// surfaces through the channel.
const parseEnvelopeEffect = (
  xml: string,
  kind: EnvelopeKind,
): Effect.Effect<ParsedEnvelope, ValidationXml> =>
  Effect.try({
    try: () => parseEnvelope(xml, kind),
    catch: (err) =>
      err instanceof ValidationXml
        ? err
        : new ValidationXml({
            message: messageOf(err),
            cause: err,
          }),
  })

// ---------------------------------------------------------------------------
// Post payload
// ---------------------------------------------------------------------------

export const buildPostPayload = (
  flags: PostFlagInputs,
): Effect.Effect<
  BuiltPayload,
  ValidationFailed | ValidationXml,
  Lexical | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const envelope = yield* loadEnvelopeIfAny(flags.file, 'post')
    const envMeta: EnvelopeMeta = envelope ? coerceMeta(envelope.meta) : {}

    const payload: Record<string, unknown> = {}
    const title = flags.title ?? envMeta.title
    if (title !== undefined) payload.title = title
    const slug = flags.slug ?? envMeta.slug
    if (slug !== undefined) payload.slug = slug
    if (flags.category) payload.__categoryName = flags.category
    else if (envMeta.category) payload.__categoryName = envMeta.category
    const summary = flags.summary ?? envMeta.summary
    if (summary !== undefined) payload.summary = summary
    const state = flags.state ?? envMeta.state
    if (state !== undefined) payload.isPublished = state === 'publish'
    const tags = flags.tags ?? envMeta.tags
    if (tags !== undefined) payload.tags = tags
    const copyright = flags.copyright ?? envMeta.copyright
    if (copyright !== undefined) payload.copyright = copyright
    const pin = flags.pin ?? envMeta.pin
    if (pin !== undefined) payload.pin = pin
    const pinOrder = flags.pinOrder ?? envMeta.pinOrder
    if (pinOrder !== undefined) payload.pinOrder = pinOrder
    const related = flags.related ?? envMeta.related
    if (related !== undefined) payload.relatedId = related
    if (flags.meta !== undefined) {
      payload.meta = yield* readJsonSpec(flags.meta)
    }
    const format = flags.format ?? envMeta.format ?? 'lexical'
    payload.contentFormat = format

    const contentSrc = yield* resolveContent(flags.content, envelope, format)
    if (contentSrc) {
      payload.content = contentSrc.content
      payload.text = contentSrc.text
    }

    return {
      payload,
      envelopeMeta: envMeta,
      contentSource: contentSrc?.origin ?? 'none',
    }
  })

// ---------------------------------------------------------------------------
// Note payload
// ---------------------------------------------------------------------------

export const buildNotePayload = (
  flags: NoteFlagInputs,
): Effect.Effect<
  BuiltPayload,
  ValidationFailed | ValidationXml,
  Lexical | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const envelope = yield* loadEnvelopeIfAny(flags.file, 'note')
    const envMeta: EnvelopeMeta = envelope ? coerceMeta(envelope.meta) : {}

    const payload: Record<string, unknown> = {}
    const title = flags.title ?? envMeta.title ?? '无题'
    payload.title = title
    const slug = flags.slug ?? envMeta.slug
    if (slug !== undefined) payload.slug = slug
    if (flags.topic) payload.__topicName = flags.topic
    else if (envMeta.topic) payload.__topicName = envMeta.topic
    const state = flags.state ?? envMeta.state
    if (state !== undefined) payload.isPublished = state === 'publish'
    const mood = flags.mood ?? envMeta.mood
    if (mood !== undefined) payload.mood = mood
    const weather = flags.weather ?? envMeta.weather
    if (weather !== undefined) payload.weather = weather
    const publicAt = flags.publicAt ?? envMeta.publicAt
    if (publicAt !== undefined) payload.publicAt = publicAt
    const password = flags.password ?? envMeta.password
    if (password !== undefined) payload.password = password
    const bookmark = flags.bookmark ?? envMeta.bookmark
    if (bookmark !== undefined) payload.bookmark = bookmark
    const location = flags.location ?? envMeta.location
    if (location !== undefined) payload.location = location

    if (flags.coords) {
      const [latRaw, lngRaw] = flags.coords.split(',').map((s) => s.trim())
      const lat = Number(latRaw)
      const lng = Number(lngRaw)
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return yield* Effect.fail(
          new ValidationFailed({
            message: `invalid --coords value "${flags.coords}", expected "lat,lng"`,
          }),
        )
      }
      payload.coordinates = { latitude: lat, longitude: lng }
    }
    if (flags.images !== undefined) {
      payload.images = yield* readJsonSpec(flags.images)
    }
    if (flags.meta !== undefined) {
      payload.meta = yield* readJsonSpec(flags.meta)
    }

    const format = flags.format ?? envMeta.format ?? 'lexical'
    payload.contentFormat = format
    const contentSrc = yield* resolveContent(flags.content, envelope, format)
    if (contentSrc) {
      payload.content = contentSrc.content
      payload.text = contentSrc.text
    }

    return {
      payload,
      envelopeMeta: envMeta,
      contentSource: contentSrc?.origin ?? 'none',
    }
  })

// ---------------------------------------------------------------------------
// Page payload — exported for W2-B's page commands to consume.
// ---------------------------------------------------------------------------

export const buildPagePayload = (
  flags: PageFlagInputs,
): Effect.Effect<
  BuiltPayload,
  ValidationFailed | ValidationXml,
  Lexical | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    // Pages reuse the `<mxpost>` envelope shape (per legacy behavior).
    const envelope = yield* loadEnvelopeIfAny(flags.file, 'post')
    const envMeta: EnvelopeMeta = envelope ? coerceMeta(envelope.meta) : {}
    const payload: Record<string, unknown> = {}
    const title = flags.title ?? envMeta.title
    if (title !== undefined) payload.title = title
    const slug = flags.slug ?? envMeta.slug
    if (slug !== undefined) payload.slug = slug
    const subtitle = flags.subtitle ?? envMeta.subtitle
    if (subtitle !== undefined) payload.subtitle = subtitle
    const order = flags.order ?? envMeta.order
    if (order !== undefined) payload.order = order
    if (flags.meta !== undefined) {
      payload.meta = yield* readJsonSpec(flags.meta)
    }
    const format = flags.format ?? envMeta.format ?? 'lexical'
    payload.contentFormat = format
    const contentSrc = yield* resolveContent(flags.content, envelope, format)
    if (contentSrc) {
      payload.content = contentSrc.content
      payload.text = contentSrc.text
    }
    return {
      payload,
      envelopeMeta: envMeta,
      contentSource: contentSrc?.origin ?? 'none',
    }
  })

// ---------------------------------------------------------------------------
// Shared content resolution
// ---------------------------------------------------------------------------

interface ResolvedContent {
  readonly content: string
  readonly text: string
  readonly origin: 'flag' | 'envelope'
}

const resolveContent = (
  flagSpec: string | undefined,
  envelope: ParsedEnvelope | null,
  format: ContentFormat,
): Effect.Effect<
  ResolvedContent | null,
  ValidationFailed | ValidationXml,
  Lexical | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    let source: { text: string; origin: 'flag' | 'envelope' } | null = null
    if (flagSpec !== undefined) {
      const src = yield* readContentSpec(flagSpec)
      if (src) source = { text: src.text, origin: 'flag' }
    } else if (envelope) {
      source = { text: envelope.contentXml, origin: 'envelope' }
    }
    if (!source) return null

    if (format === 'markdown') {
      return { content: source.text, text: source.text, origin: source.origin }
    }
    if (source.text.length === 0) {
      return yield* Effect.fail(
        new ValidationFailed({
          message: 'content is required when contentFormat is lexical',
          details: { issues: [{ path: ['content'], message: 'required' }] },
        }),
      )
    }
    const lexical = yield* Lexical
    const state = yield* lexical.litexmlToPayload(source.text)
    const lexicalJson = JSON.stringify(state)
    const text = yield* lexical.lexicalJsonToMarkdown(state)
    return { content: lexicalJson, text, origin: source.origin }
  })

export const emptyPayload = (
  format: ContentFormat,
): Effect.Effect<{ content: string; text: string }, never, Lexical> =>
  Effect.gen(function* () {
    if (format === 'markdown') return { content: '', text: '' }
    const lexical = yield* Lexical
    const state: LexicalState = yield* lexical.emptyState
    return { content: JSON.stringify(state), text: '' }
  })
