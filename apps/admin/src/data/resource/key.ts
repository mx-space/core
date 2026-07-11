function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? 'null' : stableStringify(item))).join(',')}]`
  }

  const keys = Object.keys(value as Record<string, unknown>).sort()
  const entries: string[] = []
  for (const key of keys) {
    const entryValue = (value as Record<string, unknown>)[key]
    if (entryValue === undefined) continue
    entries.push(`${JSON.stringify(key)}:${stableStringify(entryValue)}`)
  }
  return `{${entries.join(',')}}`
}

export function serializeListKey(queryKey: readonly unknown[]): string {
  return stableStringify(queryKey)
}
