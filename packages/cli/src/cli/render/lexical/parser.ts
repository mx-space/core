import { XMLParser } from 'fast-xml-parser'

export type LiteXmlNode =
  | { readonly type: 'text'; readonly value: string }
  | {
      readonly type: 'element'
      readonly tag: string
      readonly attrs: Readonly<Record<string, string>>
      readonly children: ReadonlyArray<LiteXmlNode>
    }

const TEXT_KEY = '#text'
const ATTR_KEY = ':@'

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  processEntities: true,
  trimValues: false,
  textNodeName: TEXT_KEY,
})

const normalizeAttrs = (raw: unknown): Readonly<Record<string, string>> => {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[k] = v == null ? '' : String(v)
  }
  return out
}

const normalize = (raw: unknown): LiteXmlNode[] => {
  if (!Array.isArray(raw)) return []
  const out: LiteXmlNode[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const obj = entry as Record<string, unknown>
    const attrs = normalizeAttrs(obj[ATTR_KEY])
    for (const [key, value] of Object.entries(obj)) {
      if (key === ATTR_KEY) continue
      if (key === TEXT_KEY) {
        out.push({ type: 'text', value: value == null ? '' : String(value) })
        continue
      }
      out.push({
        type: 'element',
        tag: key,
        attrs,
        children: normalize(value),
      })
    }
  }
  return out
}

export const parseLitexml = (xml: string): ReadonlyArray<LiteXmlNode> => {
  try {
    // fast-xml-parser needs a single document root; LiteXML emits multiple
    // top-level elements, so we synthesize one.
    const raw = parser.parse(`<root>${xml}</root>`) as unknown
    if (!Array.isArray(raw) || raw.length === 0) return []
    const first = raw[0] as Record<string, unknown> | undefined
    if (!first) return []
    const inner = first.root
    return normalize(inner)
  } catch {
    return []
  }
}
