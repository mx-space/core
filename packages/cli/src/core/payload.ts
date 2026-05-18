import { promises as fs } from 'node:fs'

import { readContentSpec, readJsonSpec, readStdin } from './content-spec'
import {
  coerceMeta,
  type EnvelopeKind,
  type EnvelopeMeta,
  type ParsedEnvelope,
  parseEnvelope,
} from './envelope'
import { MxsError, MxsErrorCode } from './errors'
import {
  deriveTextFromLexical,
  emptyLexicalState,
  parseToLexical,
} from './litexml-codec'

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
  payload: Record<string, unknown>
  envelopeMeta?: EnvelopeMeta
  contentSource?: 'flag' | 'envelope' | 'none'
}

export async function loadEnvelopeIfAny(
  filePath: string | undefined,
  kind: EnvelopeKind,
): Promise<ParsedEnvelope | null> {
  if (!filePath) return null
  if (filePath === '-' || filePath === 'stdin' || filePath === '/dev/stdin') {
    return parseEnvelope(await readStdin(), kind)
  }
  if (filePath.startsWith('file=')) {
    const src = await readContentSpec(filePath)
    return parseEnvelope(src?.text ?? '', kind)
  }
  const xml = await fs.readFile(filePath, 'utf8').catch((err) => {
    throw new MxsError({
      code: MxsErrorCode.ValidationFailed,
      message: `failed to read ${filePath}: ${err?.message ?? err}`,
    })
  })
  return parseEnvelope(xml, kind)
}

export async function buildPostPayload(
  flags: PostFlagInputs,
): Promise<BuiltPayload> {
  const envelope = await loadEnvelopeIfAny(flags.file, 'post')
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
    payload.meta = await readJsonSpec(flags.meta)
  }
  const format = flags.format ?? envMeta.format ?? 'lexical'
  payload.contentFormat = format

  const contentSrc = await resolveContent(flags.content, envelope, format)
  if (contentSrc) {
    payload.content = contentSrc.content
    payload.text = contentSrc.text
  }

  return {
    payload,
    envelopeMeta: envMeta,
    contentSource: contentSrc?.origin ?? 'none',
  }
}

export async function buildNotePayload(
  flags: NoteFlagInputs,
): Promise<BuiltPayload> {
  const envelope = await loadEnvelopeIfAny(flags.file, 'note')
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
      throw new MxsError({
        code: MxsErrorCode.ValidationFailed,
        message: `invalid --coords value "${flags.coords}", expected "lat,lng"`,
      })
    }
    payload.coordinates = { latitude: lat, longitude: lng }
  }
  if (flags.images !== undefined) {
    payload.images = await readJsonSpec(flags.images)
  }
  if (flags.meta !== undefined) {
    payload.meta = await readJsonSpec(flags.meta)
  }

  const format = flags.format ?? envMeta.format ?? 'lexical'
  payload.contentFormat = format
  const contentSrc = await resolveContent(flags.content, envelope, format)
  if (contentSrc) {
    payload.content = contentSrc.content
    payload.text = contentSrc.text
  }

  return {
    payload,
    envelopeMeta: envMeta,
    contentSource: contentSrc?.origin ?? 'none',
  }
}

export async function buildPagePayload(
  flags: PageFlagInputs,
): Promise<BuiltPayload> {
  const envelope = await loadEnvelopeIfAny(flags.file, 'post')
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
    payload.meta = await readJsonSpec(flags.meta)
  }
  const format = flags.format ?? envMeta.format ?? 'lexical'
  payload.contentFormat = format
  const contentSrc = await resolveContent(flags.content, envelope, format)
  if (contentSrc) {
    payload.content = contentSrc.content
    payload.text = contentSrc.text
  }
  return {
    payload,
    envelopeMeta: envMeta,
    contentSource: contentSrc?.origin ?? 'none',
  }
}

interface ResolvedContent {
  content: string
  text: string
  origin: 'flag' | 'envelope'
}

async function resolveContent(
  flagSpec: string | undefined,
  envelope: ParsedEnvelope | null,
  format: ContentFormat,
): Promise<ResolvedContent | null> {
  let source: { text: string; origin: 'flag' | 'envelope' } | null = null
  if (flagSpec !== undefined) {
    const src = await readContentSpec(flagSpec)
    if (src) source = { text: src.text, origin: 'flag' }
  } else if (envelope) {
    source = { text: envelope.contentXml, origin: 'envelope' }
  }
  if (!source) return null

  if (format === 'markdown') {
    return { content: source.text, text: source.text, origin: source.origin }
  }
  if (source.text.length === 0) {
    throw new MxsError({
      code: MxsErrorCode.ValidationFailed,
      message: 'content is required when contentFormat is lexical',
      details: { issues: [{ path: ['content'], message: 'required' }] },
    })
  }
  const state = parseToLexical(source.text)
  const lexicalJson = JSON.stringify(state)
  const text = deriveTextFromLexical(state)
  return { content: lexicalJson, text, origin: source.origin }
}

export function emptyPayload(format: ContentFormat): {
  content: string
  text: string
} {
  if (format === 'markdown') return { content: '', text: '' }
  const state = emptyLexicalState()
  return { content: JSON.stringify(state), text: '' }
}
