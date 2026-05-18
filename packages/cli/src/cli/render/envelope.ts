import { escapeXml, formatScalar } from '../../services/Renderer/content'

const renderEnvelopeMeta = (key: string, value: unknown): string => {
  if (key === 'tags' && Array.isArray(value)) {
    const tags = value
      .map((item) => `      <tag>${escapeXml(formatScalar(item))}</tag>`)
      .join('\n')
    return `    <tags>\n${tags}\n    </tags>`
  }
  return `    <${key}>${escapeXml(formatScalar(value))}</${key}>`
}

export interface EnvelopeInput {
  /** Root element name, e.g. 'mxpost' / 'mxnote' / 'mxpage'. */
  readonly root: string
  readonly meta: ReadonlyArray<readonly [string, unknown]>
  readonly content: string
}

export const renderEnvelope = (input: EnvelopeInput): string => {
  const { root, meta: rawMeta, content } = input
  const meta = rawMeta.filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  )
  const metaLines = meta.map(([key, value]) => renderEnvelopeMeta(key, value))
  return `<${root}>
  <meta>
${metaLines.join('\n')}
  </meta>
  <content>
${content}
  </content>
</${root}>`
}
