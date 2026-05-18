import { formatScalar } from './content'
import { tryFormatTimestamp } from './datetime'

// Generic readable renderer for arbitrary payloads. Drives the default
// `--output readable` rendering for commands that emit ad-hoc objects via
// `emitSuccess` (mutation responses for auth/profile/config/update/category/
// topic/...). Keep the shape close to YAML so the output remains pasteable
// into prose.
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  !(value instanceof Date)

// Auto-detect timestamps inside arbitrary payloads and route them through
// the friendlier formatter so the raw machine form never leaks into the
// readable output.
const formatLeaf = (value: unknown): string =>
  tryFormatTimestamp(value, { style: 'both' }) ?? formatScalar(value)

const renderReadableLines = (data: unknown, indent: number): string[] => {
  const pad = '  '.repeat(indent)
  if (data === null || data === undefined) return []
  if (data instanceof Date) {
    return [`${pad}${formatLeaf(data)}`]
  }
  if (typeof data === 'string') {
    if (data.length === 0) return []
    const ts = tryFormatTimestamp(data, { style: 'both' })
    if (ts !== null) return [`${pad}${ts}`]
    return data.split('\n').map((line) => `${pad}${line}`)
  }
  if (typeof data === 'number' || typeof data === 'boolean') {
    return [`${pad}${String(data)}`]
  }
  if (Array.isArray(data)) {
    const lines: string[] = []
    for (const item of data) {
      if (isPlainObject(item)) {
        const inner = renderReadableLines(item, indent + 1)
        if (inner.length === 0) continue
        // Replace the first line's leading pad with "- " marker.
        const first = inner[0]
        const stripped = first.startsWith(pad + '  ')
          ? first.slice((pad + '  ').length)
          : first.trimStart()
        lines.push(`${pad}- ${stripped}`)
        for (let i = 1; i < inner.length; i++) lines.push(inner[i])
      } else if (Array.isArray(item)) {
        const inner = renderReadableLines(item, indent + 1)
        if (inner.length === 0) continue
        lines.push(`${pad}-`)
        lines.push(...inner)
      } else if (item !== null && item !== undefined) {
        lines.push(`${pad}- ${formatLeaf(item)}`)
      }
    }
    return lines
  }
  if (isPlainObject(data)) {
    const lines: string[] = []
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined || value === '') continue
      if (Array.isArray(value)) {
        if (value.length === 0) continue
        const allScalar = value.every(
          (v) =>
            v === null ||
            v === undefined ||
            v instanceof Date ||
            typeof v !== 'object',
        )
        if (allScalar) {
          const parts = value
            .filter((v) => v !== null && v !== undefined)
            .map((v) => formatLeaf(v))
          lines.push(`${pad}${key}: ${parts.join(', ')}`)
        } else {
          lines.push(`${pad}${key}:`)
          lines.push(...renderReadableLines(value, indent + 1))
        }
      } else if (isPlainObject(value)) {
        const inner = renderReadableLines(value, indent + 1)
        if (inner.length === 0) continue
        lines.push(`${pad}${key}:`)
        lines.push(...inner)
      } else {
        lines.push(`${pad}${key}: ${formatLeaf(value)}`)
      }
    }
    return lines
  }
  return [`${pad}${String(data)}`]
}

export const renderReadableGeneric = (data: unknown): string =>
  renderReadableLines(data, 0).join('\n')
