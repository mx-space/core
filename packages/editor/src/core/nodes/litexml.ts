export interface SerializedLiteXmlFallbackNode {
  $?: {
    blockId?: unknown
  }
  type: string
  version?: unknown
}

const XML_ESCAPE_MAP: Record<string, string> = {
  '"': '&quot;',
  '&': '&amp;',
  "'": '&apos;',
  '<': '&lt;',
  '>': '&gt;',
}

export function escapeLiteXml(value: string): string {
  return value.replaceAll(/["&'<>]/g, (ch) => XML_ESCAPE_MAP[ch] ?? ch)
}

function buildAttrs(attrs: Record<string, string | undefined>) {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => ` ${key}="${escapeLiteXml(value!)}"`)
    .join('')
}

export function serializeLiteXmlFallbackNode<
  T extends SerializedLiteXmlFallbackNode,
>(node: T): string {
  const { $, type, version: _version, ...data } = node
  const attrs: Record<string, string | undefined> = { type }

  const blockId = $?.blockId
  if (typeof blockId === 'string' && blockId !== '') attrs.id = blockId
  if (Object.keys(data).length > 0) attrs.data = JSON.stringify(data)

  return `<node${buildAttrs(attrs)} />`
}
