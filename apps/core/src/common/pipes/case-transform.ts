const LEADING_UNDERSCORE_RE = /^_+/
const SNAKE_BOUNDARY_RE = /_([\da-z])/g

export const camelKey = (key: string): string => {
  if (!key.includes('_')) return key
  const leading = LEADING_UNDERSCORE_RE.exec(key)?.[0] ?? ''
  const body = key.slice(leading.length)
  if (!body.includes('_')) return key
  return (
    leading +
    body.replaceAll(SNAKE_BOUNDARY_RE, (_, c: string) => c.toUpperCase())
  )
}

const isTransformableObject = (
  value: unknown,
): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  if (value instanceof Date) return false
  if (Buffer.isBuffer(value)) return false
  return true
}

const transform = (value: unknown, deep: boolean): unknown => {
  if (Array.isArray(value)) {
    return deep ? value.map((item) => transform(item, deep)) : value
  }
  if (!isTransformableObject(value)) return value
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    result[camelKey(key)] = deep ? transform(item, deep) : item
  }
  return result
}

export const transformRequestCase = <T>(
  value: T,
  options: { deep?: boolean } = {},
): T => {
  const { deep = true } = options
  return transform(value, deep) as T
}
