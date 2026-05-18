import { formatScalar } from './content'

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

const renderReadableLines = (data: unknown, indent: number): string[] => {
  const pad = '  '.repeat(indent)
  if (data === null || data === undefined) return []
  if (data instanceof Date) return [`${pad}${data.toISOString()}`]
  if (typeof data === 'string') {
    if (data.length === 0) return []
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
        lines.push(`${pad}- ${formatScalar(item)}`)
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
            .map((v) => formatScalar(v))
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
      } else if (value instanceof Date) {
        lines.push(`${pad}${key}: ${value.toISOString()}`)
      } else {
        lines.push(`${pad}${key}: ${formatScalar(value)}`)
      }
    }
    return lines
  }
  return [`${pad}${String(data)}`]
}

export const renderReadableGeneric = (data: unknown): string =>
  renderReadableLines(data, 0).join('\n')
