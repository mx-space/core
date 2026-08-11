export const unwrapData = (raw: unknown): unknown => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const env = raw as { data?: unknown }
    if ('data' in env) return env.data
  }
  return raw
}

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
