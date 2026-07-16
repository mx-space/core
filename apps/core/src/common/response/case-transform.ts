const ARRAY_SEGMENT = '[]'
export const BYPASS_CASE_TRANSFORM_ROOT = '$'
const IDENTIFIER_RE = /^[a-z][\dA-Za-z]*$/
const UPPER_RE = /[A-Z]/
const LOWER_UPPER_RE = /([\da-z])([A-Z])/g
const UPPER_LOWER_RE = /([A-Z]+)([A-Z][a-z])/g

// Boundary-aware: `articleURL` → `article_url`, `HTMLContent` → `html_content`,
// rather than the naïve `_a_r_t_i_c_l_e__u_r_l`.
const snakeKey = (key: string): string => {
  if (!IDENTIFIER_RE.test(key) || !UPPER_RE.test(key)) return key
  return key
    .replaceAll(UPPER_LOWER_RE, '$1_$2')
    .replaceAll(LOWER_UPPER_RE, '$1_$2')
    .toLowerCase()
}

const parseBypassPath = (path: string): string[] => {
  if (path === BYPASS_CASE_TRANSFORM_ROOT) return []

  return path
    .split('.')
    .flatMap((segment) =>
      segment.endsWith(ARRAY_SEGMENT)
        ? [segment.slice(0, -ARRAY_SEGMENT.length), ARRAY_SEGMENT]
        : [segment],
    )
    .filter(Boolean)
}

const isExactBypass = (segments: string[], bypass: string[][]): boolean =>
  bypass.some(
    (path) =>
      path.length === segments.length &&
      path.every((part, index) => part === segments[index]),
  )

const transform = (
  value: unknown,
  segments: string[],
  bypass: string[][],
): unknown => {
  if (value === null || typeof value !== 'object' || value instanceof Date) {
    return value
  }
  if (Array.isArray(value)) {
    const childSegments = [...segments, ARRAY_SEGMENT]
    return value.map((item) => transform(item, childSegments, bypass))
  }
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const childSegments = [...segments, key]
    result[snakeKey(key)] = isExactBypass(childSegments, bypass)
      ? item
      : transform(item, childSegments, bypass)
  }
  return result
}

export const transformResponseCase = (
  value: unknown,
  bypassPaths: string[] = [],
): unknown => {
  const bypass = bypassPaths.map(parseBypassPath)
  return isExactBypass([], bypass) ? value : transform(value, [], bypass)
}
