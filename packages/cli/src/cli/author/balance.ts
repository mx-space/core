const VOID_TAGS = new Set(['br', 'hr', 'img'])

const TAG = /<(\/?)([a-z][\w-]*)\b[^>]*?(\/?)>/gi

const OPAQUE: Array<[string, string]> = [
  ['<![CDATA[', ']]>'],
  ['<!--', '-->'],
]

const stripOpaque = (xml: string): string => {
  let out = ''
  let at = 0
  while (at < xml.length) {
    const next = OPAQUE.map(([open, close]) => ({
      close,
      index: xml.indexOf(open, at),
    }))
      .filter(({ index }) => index !== -1)
      .sort((a, b) => a.index - b.index)[0]
    if (!next) return out + xml.slice(at)
    out += xml.slice(at, next.index)
    const end = xml.indexOf(next.close, next.index)
    if (end === -1) return out
    at = end + next.close.length
  }
  return out
}

// The LiteXML reader is an HTML parser: a mismatched tag does not fail, it
// silently re-nests every following block. Agent writes are checked first.
export function unbalancedTag(xml: string): string | null {
  const open: string[] = []
  for (const match of stripOpaque(xml).matchAll(TAG)) {
    const [, closing, rawName, selfClosing] = match
    const name = rawName!.toLowerCase()
    if (closing) {
      const expected = open.pop()
      if (expected !== name) {
        return expected
          ? `</${name}> closes <${expected}>`
          : `</${name}> has no opening tag`
      }
    } else if (!selfClosing && !VOID_TAGS.has(name)) {
      open.push(name)
    }
  }
  const unclosed = open.at(-1)
  return unclosed ? `<${unclosed}> is never closed` : null
}
