import type { ChatMessage } from '@haklex/rich-agent-core'

export function buildMxEditorLitexmlSystemMessages(): ChatMessage[] {
  const content = [
    'The document editing tools use LiteXML for their `xml` parameter.',
    '',
    'General rules:',
    '- The `xml` value for `insert_node` and `replace_node` must contain one or more LiteXML block elements.',
    '- For normal prose, prefer existing LiteXML tags such as `<p>`, `<h2>`, `<ul>`, `<ol>`, `<li>`, `<blockquote>`, and `<codeblock lang="...">...</codeblock>`.',
    '- Mx custom block nodes must use the LiteXML fallback node format. Do not invent `<map>` or `<afilmory>` tags.',
    '- The fallback node format is `<node type="..." data="{...}" />`. The `data` value is a JSON string and must be escaped correctly as an XML attribute.',
    '',
    'Map node:',
    '- Format: `<node type="map" data="{...}" />`',
    '- Common fields: `title: string`, `pois: [{ title?: string, lat: number, lon: number, description?: string }]`, `track: { url: string }`, and `view: { center: [number, number], zoom?: number }`.',
    '',
    'Afilmory node:',
    '- Format: `<node type="afilmory" data="{...}" />`',
    '- Common fields: `baseUrl: string`, `source: { kind: "list", items: [{ id: string, w: number, h: number, hash?: string }] } | { kind: "filter", filter: object }`, `layout?: "grid" | "masonry" | "carousel"`, `title?: string`, and `caption?: string`.',
  ].join('\n')

  return [{ content, role: 'system' }]
}
