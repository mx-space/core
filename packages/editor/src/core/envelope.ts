import { EnvelopeParseError } from './errors'

export type EnvelopeKind = 'post' | 'note'

export interface ContentSpan {
  readonly start: number
  readonly end: number
  readonly selfClosing: boolean
}

export interface ParsedEnvelope {
  readonly kind: EnvelopeKind
  readonly meta: Record<string, unknown>
  readonly contentXml: string
  readonly contentSpan: ContentSpan | null
  readonly sourceMap: Record<string, number>
}

const ROOT_TAGS: Record<EnvelopeKind, string> = {
  post: 'mxpost',
  note: 'mxnote',
}

const DEFAULT_ARRAY_TAGS: Readonly<Record<string, string>> = {
  tags: 'tag',
  related: 'id',
}

export interface ParseEnvelopeOptions {
  readonly arrayTags?: Readonly<Record<string, string>>
}

const SKIP_TEXT_RE = /^\s*$/

function kebabToCamel(name: string): string {
  return name.replaceAll(/-([a-z])/g, (_, c) => c.toUpperCase())
}

function camelToKebab(name: string): string {
  return name.replaceAll(/([A-Z])/g, (_, c) => `-${c.toLowerCase()}`)
}

export function flagToTag(flag: string): string {
  return kebabToCamel(flag.replace(/^--/, ''))
}

export function tagToFlag(tag: string): string {
  return `--${camelToKebab(tag)}`
}

interface Token {
  kind: 'open' | 'close' | 'self' | 'text' | 'cdata'
  name?: string
  raw?: string
  text?: string
  line: number
  start: number
  end: number
}

function tokenize(xml: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let line = 1
  while (i < xml.length) {
    const ch = xml[i]
    if (ch === '<') {
      if (xml.startsWith('<!--', i)) {
        const end = xml.indexOf('-->', i + 4)
        if (end < 0) {
          throw new EnvelopeParseError('unterminated XML comment', line)
        }
        line += countLines(xml.slice(i, end + 3))
        i = end + 3
        continue
      }
      if (xml.startsWith('<![CDATA[', i)) {
        const end = xml.indexOf(']]>', i + 9)
        if (end < 0) {
          throw new EnvelopeParseError('unterminated CDATA', line)
        }
        const inner = xml.slice(i + 9, end)
        const endAt = end + 3
        tokens.push({ kind: 'cdata', text: inner, line, start: i, end: endAt })
        line += countLines(xml.slice(i, endAt))
        i = endAt
        continue
      }
      const close = xml.indexOf('>', i)
      if (close < 0) {
        throw new EnvelopeParseError('unterminated tag', line)
      }
      const raw = xml.slice(i + 1, close).trim()
      const endAt = close + 1
      if (raw.startsWith('/')) {
        tokens.push({
          kind: 'close',
          name: raw.slice(1).trim(),
          line,
          start: i,
          end: endAt,
        })
      } else if (raw.endsWith('/')) {
        const name = raw.slice(0, -1).trim().split(/\s+/)[0] ?? ''
        tokens.push({ kind: 'self', name, raw, line, start: i, end: endAt })
      } else {
        const name = raw.split(/\s+/)[0] ?? ''
        tokens.push({ kind: 'open', name, raw, line, start: i, end: endAt })
      }
      line += countLines(xml.slice(i, endAt))
      i = endAt
    } else {
      const next = xml.indexOf('<', i)
      const endAt = next < 0 ? xml.length : next
      const text = xml.slice(i, endAt)
      tokens.push({ kind: 'text', text, line, start: i, end: endAt })
      line += countLines(text)
      i = endAt
    }
  }
  return tokens
}

function countLines(s: string): number {
  let count = 0
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) count++
  }
  return count
}

function decodeXmlEntities(s: string): string {
  return s
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
}

export function parseEnvelope(
  xml: string,
  kind: EnvelopeKind,
  options: ParseEnvelopeOptions = {},
): ParsedEnvelope {
  const arrayTags = { ...DEFAULT_ARRAY_TAGS, ...options.arrayTags }
  const tokens = tokenize(xml)
  const rootName = ROOT_TAGS[kind]

  const rootStart = tokens.findIndex(
    (t) => t.kind === 'open' && t.name === rootName,
  )
  if (rootStart < 0) {
    throw new EnvelopeParseError(`expected root <${rootName}>`, 1)
  }
  let depth = 0
  let rootEnd = -1
  for (let i = rootStart; i < tokens.length; i++) {
    const t = tokens[i]!
    if (t.kind === 'open' && t.name === rootName) depth++
    else if (t.kind === 'close' && t.name === rootName) {
      depth--
      if (depth === 0) {
        rootEnd = i
        break
      }
    }
  }
  if (rootEnd < 0) {
    throw new EnvelopeParseError(
      `unterminated <${rootName}>`,
      tokens[rootStart]?.line ?? 1,
    )
  }

  const inner = tokens.slice(rootStart + 1, rootEnd)
  const meta: Record<string, unknown> = {}
  const sourceMap: Record<string, number> = {}
  let contentXml = ''
  let contentSpan: ContentSpan | null = null

  let i = 0
  while (i < inner.length) {
    const t = inner[i]!
    if (t.kind === 'text' || t.kind === 'cdata') {
      i++
      continue
    }
    if (t.kind === 'open' && t.name === 'meta') {
      const closeIdx = findMatchingClose(inner, i, 'meta')
      parseMeta(inner.slice(i + 1, closeIdx), meta, sourceMap, arrayTags)
      i = closeIdx + 1
      continue
    }
    if (t.kind === 'open' && t.name === 'content') {
      const closeIdx = findMatchingClose(inner, i, 'content')
      const closeTok = inner[closeIdx]!
      contentXml = renderInnerXml(inner.slice(i + 1, closeIdx))
      contentSpan = { start: t.end, end: closeTok.start, selfClosing: false }
      sourceMap.content = t.line
      i = closeIdx + 1
      continue
    }
    if (t.kind === 'self' && t.name === 'content') {
      contentXml = ''
      contentSpan = { start: t.start, end: t.end, selfClosing: true }
      sourceMap.content = t.line
      i++
      continue
    }
    if (t.kind === 'open' || t.kind === 'self') {
      throw new EnvelopeParseError(`unexpected <${t.name}> at root`, t.line)
    }
    i++
  }

  return { kind, meta, contentXml, contentSpan, sourceMap }
}

export function spliceEnvelopeContent(
  source: string,
  span: ContentSpan,
  body: string,
): string {
  if (span.selfClosing) {
    return `${source.slice(0, span.start)}<content>\n${body}\n</content>${source.slice(span.end)}`
  }
  return `${source.slice(0, span.start)}\n${body}\n  ${source.slice(span.end)}`
}

function findMatchingClose(
  tokens: Token[],
  startOpen: number,
  name: string,
): number {
  let depth = 0
  for (let i = startOpen; i < tokens.length; i++) {
    const t = tokens[i]!
    if (t.kind === 'open' && t.name === name) depth++
    else if (t.kind === 'close' && t.name === name) {
      depth--
      if (depth === 0) return i
    }
  }
  throw new EnvelopeParseError(
    `unterminated <${name}>`,
    tokens[startOpen]?.line ?? 1,
  )
}

function parseMeta(
  tokens: Token[],
  meta: Record<string, unknown>,
  sourceMap: Record<string, number>,
  arrayTags: Readonly<Record<string, string>>,
): void {
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]!
    if (t.kind === 'text' || t.kind === 'cdata') {
      i++
      continue
    }
    if (t.kind === 'close') {
      i++
      continue
    }
    if (t.kind === 'self') {
      const key = t.name!
      meta[key] = ''
      sourceMap[`meta.${key}`] = t.line
      i++
      continue
    }
    if (t.kind === 'open') {
      const name = t.name!
      const closeIdx = findMatchingClose(tokens, i, name)
      const inner = tokens.slice(i + 1, closeIdx)
      const childTag = arrayTags[name]
      if (childTag) {
        const items: string[] = []
        let j = 0
        while (j < inner.length) {
          const c = inner[j]!
          if (c.kind === 'open' && c.name === childTag) {
            const cc = findMatchingClose(inner, j, childTag)
            items.push(textOf(inner.slice(j + 1, cc)))
            j = cc + 1
          } else {
            j++
          }
        }
        meta[name] = items
      } else {
        meta[name] = textOf(inner)
      }
      sourceMap[`meta.${name}`] = t.line
      i = closeIdx + 1
      continue
    }
    i++
  }
}

function textOf(tokens: Token[]): string {
  let s = ''
  for (const t of tokens) {
    if (t.kind === 'text' && t.text) s += t.text
    else if (t.kind === 'cdata' && t.text) s += t.text
  }
  return decodeXmlEntities(s).trim()
}

function renderInnerXml(tokens: Token[]): string {
  let out = ''
  for (const t of tokens) {
    if (t.kind === 'text') out += t.text ?? ''
    else if (t.kind === 'cdata') out += `<![CDATA[${t.text ?? ''}]]>`
    else if (t.kind === 'open') out += `<${t.raw ?? t.name}>`
    else if (t.kind === 'self') out += `<${t.raw ?? `${t.name}/`}>`
    else if (t.kind === 'close') out += `</${t.name}>`
  }
  if (out.startsWith('\n')) out = out.slice(1)
  if (out.endsWith('\n')) out = out.slice(0, -1)
  if (SKIP_TEXT_RE.test(out)) return ''
  return out
}

export interface EnvelopeMeta {
  title?: string
  slug?: string
  category?: string
  topic?: string
  state?: 'publish' | 'draft'
  summary?: string
  copyright?: boolean
  pin?: string
  pinOrder?: number
  related?: string[]
  tags?: string[]
  mood?: string
  weather?: string
  publicAt?: string
  password?: string
  bookmark?: boolean
  location?: string
  subtitle?: string
  order?: number
  format?: 'lexical' | 'markdown'
}

export function coerceMeta(raw: Record<string, unknown>): EnvelopeMeta {
  const out: EnvelopeMeta = {}
  const get = (key: string) => raw[key]

  const title = get('title')
  if (typeof title === 'string') out.title = title
  const slug = get('slug')
  if (typeof slug === 'string') out.slug = slug
  const category = get('category')
  if (typeof category === 'string') out.category = category
  const topic = get('topic')
  if (typeof topic === 'string') out.topic = topic
  const summary = get('summary')
  if (typeof summary === 'string') out.summary = summary
  const state = get('state')
  if (state === 'publish' || state === 'draft') out.state = state
  const copyright = get('copyright')
  if (typeof copyright === 'string') {
    out.copyright = copyright === 'true'
  }
  const pin = get('pin')
  if (typeof pin === 'string') out.pin = pin
  const pinOrder = get('pinOrder')
  if (typeof pinOrder === 'string' && pinOrder.length > 0) {
    const n = Number(pinOrder)
    if (!Number.isNaN(n)) out.pinOrder = n
  }
  const tags = get('tags')
  if (Array.isArray(tags)) out.tags = tags as string[]
  const related = get('related')
  if (Array.isArray(related)) out.related = related as string[]
  const mood = get('mood')
  if (typeof mood === 'string') out.mood = mood
  const weather = get('weather')
  if (typeof weather === 'string') out.weather = weather
  const publicAt = get('publicAt')
  if (typeof publicAt === 'string') out.publicAt = publicAt
  const password = get('password')
  if (typeof password === 'string') out.password = password
  const bookmark = get('bookmark')
  if (typeof bookmark === 'string') {
    out.bookmark = bookmark === 'true'
  }
  const location = get('location')
  if (typeof location === 'string') out.location = location
  const subtitle = get('subtitle')
  if (typeof subtitle === 'string') out.subtitle = subtitle
  const order = get('order')
  if (typeof order === 'string' && order.length > 0) {
    const n = Number(order)
    if (!Number.isNaN(n)) out.order = n
  }
  const format = get('format')
  if (format === 'lexical' || format === 'markdown') out.format = format

  return out
}

export function listUnknownMetaKeys(
  raw: Record<string, unknown>,
  known: ReadonlyArray<string>,
): string[] {
  return Object.keys(raw).filter((k) => !known.includes(k))
}
