import {
  deserializeMxLitexmlToLexical,
  parseEnvelope,
  serializeMxLexicalToLitexml,
  stripMxLitexmlDocWrapper,
} from '@mx-space/editor'
import {
  type DocContent,
  type DocFields,
  readDocContent,
  SECRET_FIELD_KEYS,
} from '@mx-space/editor/loro'
import type { LoroDoc } from 'loro-crdt'

export interface CategoryRef {
  readonly id: string
  readonly name?: string
  readonly slug: string
}

type Section = keyof DocFields

const HIDDEN_KEYS = new Set(['isPublished', 'state', ...SECRET_FIELD_KEYS])
const META_KEYS = new Set(['aiGen', 'cover', 'paywall', 'skillIds'])
const META_TAG_ORDER = ['slug', 'category', 'tags', 'summary']

const camelToKebab = (key: string) =>
  key.replaceAll(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

const kebabToCamel = (name: string) =>
  name.replaceAll(/-([a-z])/g, (_, c: string) => c.toUpperCase())

const escapeText = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const encodeValue = (value: unknown) =>
  escapeText(typeof value === 'string' ? value : JSON.stringify(value))

const metaLine = (tag: string, value: unknown) => {
  if (tag === 'tags' && Array.isArray(value)) {
    if (value.length === 0) return '    <tags></tags>'
    const items = value.map(
      (item) => `      <tag>${escapeText(String(item))}</tag>`,
    )
    return `    <tags>\n${items.join('\n')}\n    </tags>`
  }
  return `    <${tag}>${encodeValue(value)}</${tag}>`
}

const categoryLabel = (id: unknown, categories: readonly CategoryRef[]) =>
  categories.find((c) => c.id === id)?.slug ?? String(id)

function fieldEntries(fields: DocFields | undefined) {
  const entries: { section: Section; key: string; value: unknown }[] = []
  for (const section of ['typeSpecificData', 'meta'] as const) {
    for (const [key, value] of Object.entries(fields?.[section] ?? {})) {
      if (!HIDDEN_KEYS.has(key)) entries.push({ section, key, value })
    }
  }
  const rank = (key: string) => {
    const name = key === 'categoryId' ? 'category' : key
    const i = META_TAG_ORDER.indexOf(name)
    return i === -1 ? META_TAG_ORDER.length : i
  }
  return entries.sort((a, b) => rank(a.key) - rank(b.key))
}

export function renderDraftEnvelope(
  doc: LoroDoc,
  categories: readonly CategoryRef[] = [],
): string {
  const { content, fields, title } = readDocContent(doc)
  const lines = [metaLine('title', title)]
  for (const { key, value } of fieldEntries(fields)) {
    lines.push(
      key === 'categoryId'
        ? metaLine('category', categoryLabel(value, categories))
        : metaLine(camelToKebab(key), value),
    )
  }
  const body = stripMxLitexmlDocWrapper(
    serializeMxLexicalToLitexml(JSON.parse(content), { compact: false }),
  ).replaceAll(/^\s*\n|\n\s*$/g, '')
  return `<mxpost>\n  <meta>\n${lines.join('\n')}\n  </meta>\n  <content>\n${body}\n  </content>\n</mxpost>`
}

function decodeValue(raw: unknown, previous: unknown): unknown {
  if (Array.isArray(raw)) return raw.map(String)
  const text = String(raw)
  if (typeof previous === 'string') return text
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function resolveCategory(label: string, categories: readonly CategoryRef[]) {
  const match = categories.find(
    (c) => c.slug === label || c.name === label || c.id === label,
  )
  if (!match) {
    const known = categories.map((c) => c.slug).join(', ')
    throw new Error(`unknown category "${label}" (known: ${known})`)
  }
  return match.id
}

export function readDraftEnvelope(
  xml: string,
  current: DocFields | undefined,
  categories: readonly CategoryRef[] = [],
): DocContent {
  const envelope = parseEnvelope(xml, 'post')
  const { title, ...raw } = envelope.meta
  const sectionOf = (key: string): Section => {
    if (current?.meta && key in current.meta) return 'meta'
    if (current?.typeSpecificData && key in current.typeSpecificData) {
      return 'typeSpecificData'
    }
    return META_KEYS.has(key) ? 'meta' : 'typeSpecificData'
  }
  const currentCategory = current?.typeSpecificData?.categoryId
  const out: DocFields = {
    meta: current?.meta ? {} : null,
    typeSpecificData: current?.typeSpecificData ? {} : null,
  }
  for (const [tag, value] of Object.entries(raw)) {
    const name = kebabToCamel(tag)
    if (HIDDEN_KEYS.has(name)) continue
    if (name === 'category') {
      out.typeSpecificData = {
        ...out.typeSpecificData,
        categoryId:
          String(value) === categoryLabel(currentCategory, categories)
            ? currentCategory
            : resolveCategory(String(value), categories),
      }
      continue
    }
    const section = sectionOf(name)
    out[section] = {
      ...out[section],
      [name]: decodeValue(value, current?.[section]?.[name]),
    }
  }
  for (const section of ['meta', 'typeSpecificData'] as const) {
    for (const [key, value] of Object.entries(current?.[section] ?? {})) {
      if (HIDDEN_KEYS.has(key)) out[section] = { ...out[section], [key]: value }
    }
  }
  const content = JSON.stringify(
    deserializeMxLitexmlToLexical(`<doc>${envelope.contentXml}</doc>`),
  )
  return {
    content,
    fields: out,
    title: typeof title === 'string' ? title : '',
  }
}

interface LexicalNode {
  readonly $?: { readonly blockId?: string }
}

interface LexicalState {
  readonly root: { readonly children: LexicalNode[] }
}

const blockIdOf = (node: LexicalNode) => node.$?.blockId

function mergeBlocks(current: string, before: string, after: string) {
  const state = JSON.parse(current) as LexicalState
  const live = new Map(
    state.root.children.map((node) => [blockIdOf(node), node] as const),
  )
  const rendered = new Map(
    (JSON.parse(before) as LexicalState).root.children.map(
      (node) => [blockIdOf(node), JSON.stringify(node)] as const,
    ),
  )
  const children = (JSON.parse(after) as LexicalState).root.children.map(
    (node) => {
      const id = blockIdOf(node)
      const untouched =
        id !== undefined &&
        live.has(id) &&
        rendered.get(id) === JSON.stringify(node)
      return untouched ? live.get(id)! : node
    },
  )
  return JSON.stringify({ ...state, root: { ...state.root, children } })
}

function mergeFields(
  current: DocFields | undefined,
  before: DocFields | undefined,
  after: DocFields | undefined,
): DocFields | undefined {
  let merged = current
  for (const section of ['meta', 'typeSpecificData'] as const) {
    const keys = new Set([
      ...Object.keys(before?.[section] ?? {}),
      ...Object.keys(after?.[section] ?? {}),
    ])
    for (const key of keys) {
      const next = after?.[section]?.[key]
      if (JSON.stringify(before?.[section]?.[key]) === JSON.stringify(next)) {
        continue
      }
      const values = { ...merged?.[section] }
      if (next === undefined) delete values[key]
      else values[key] = next
      merged = {
        meta: merged?.meta ?? null,
        typeSpecificData: merged?.typeSpecificData ?? null,
        [section]: values,
      }
    }
  }
  return merged
}

export function readDraftEdit(
  before: string,
  after: string,
  current: DocContent,
  categories: readonly CategoryRef[] = [],
): DocContent {
  const from = readDraftEnvelope(before, current.fields, categories)
  const to = readDraftEnvelope(after, current.fields, categories)
  return {
    content: mergeBlocks(current.content, from.content, to.content),
    fields: mergeFields(current.fields, from.fields, to.fields),
    title: from.title === to.title ? current.title : to.title,
  }
}

const blockLines = (xml: string) =>
  xml
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^<[a-z][\w-]*\s+id="[^"]+"/i.test(line))

export function renderOutline(xml: string): string {
  const title = xml.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''
  const lines = [`# ${title}`]
  let current: { line: string; count: number } | null = null
  let leading = 0
  const flush = () => {
    if (current) lines.push(`${current.line} — ${current.count} blocks`)
  }
  for (const block of blockLines(xml)) {
    const heading = block.match(
      /^<h([1-6])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/,
    )
    if (heading) {
      flush()
      const text = heading[3].replaceAll(/<[^>]+>/g, '')
      current = {
        line: `${'#'.repeat(Number(heading[1]))} ${text} [${heading[2]}]`,
        count: 0,
      }
    } else if (current) {
      current.count++
    } else {
      leading++
    }
  }
  flush()
  if (leading)
    lines.splice(1, 0, `(before the first heading) — ${leading} blocks`)
  return lines.join('\n')
}

export function selectionBlocks(
  content: string,
  ids: readonly string[],
): string {
  const wanted = new Set(ids)
  const state = JSON.parse(content) as LexicalState
  const children = state.root.children.filter((node) =>
    wanted.has(blockIdOf(node) ?? ''),
  )
  if (children.length === 0) return ''
  return stripMxLitexmlDocWrapper(
    serializeMxLexicalToLitexml(
      { ...state, root: { ...state.root, children } } as never,
      { compact: false },
    ),
  ).replaceAll(/^\s*\n|\n\s*$/g, '')
}
