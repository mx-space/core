// YAML scalar formatter for markdown-frontmatter output. Quote when the value
// could otherwise be parsed as a different type, contain delimiters, or start
// with a YAML indicator.
const YAML_NEEDS_QUOTING =
  /^\s|\s$|[\n"#':\\]|^[!%&*,>?@[\]`{|}-]|^(?:true|false|null|yes|no|on|off|~)$/i

export const yamlScalar = (value: unknown): string => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean' || typeof value === 'number')
    return String(value)
  if (value instanceof Date) return value.toISOString()
  const str = typeof value === 'string' ? value : String(value)
  if (str === '') return "''"
  if (YAML_NEEDS_QUOTING.test(str)) {
    return `"${str.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
  }
  return str
}

export const yamlValue = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    if (value.length === 0) return ['[]']
    return value.map((item) => `  - ${yamlScalar(item)}`)
  }
  return [yamlScalar(value)]
}

export interface FrontmatterInput {
  readonly title?: string
  readonly fields: ReadonlyArray<readonly [string, unknown]>
  readonly summary?: string
}

export const frontmatter = (input: FrontmatterInput): string => {
  const { title, fields: rawFields, summary } = input
  const fields = rawFields.filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  )
  const lines: string[] = ['---']
  if (title) lines.push(`title: ${yamlScalar(title)}`)
  for (const [key, value] of fields) {
    const parts = yamlValue(value)
    if (parts.length === 1) {
      lines.push(`${key}: ${parts[0]}`)
    } else {
      lines.push(`${key}:`)
      for (const item of parts) lines.push(item)
    }
  }
  if (summary) {
    lines.push(`summary: ${yamlScalar(summary)}`)
  }
  lines.push('---')
  return lines.join('\n')
}
