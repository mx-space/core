export const camelizeDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(camelizeDeep)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key.replaceAll(/_([\da-z])/g, (_, char: string) => char.toUpperCase()),
        camelizeDeep(item),
      ]),
    )
  }
  return value
}
