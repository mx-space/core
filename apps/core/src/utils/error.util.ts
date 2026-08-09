const MAX_CAUSE_DEPTH = 5

export function describeError(error: unknown): string {
  const chain: string[] = []
  let current: unknown = error

  while (current instanceof Error && chain.length < MAX_CAUSE_DEPTH) {
    chain.push(`${current.name}: ${current.message}`)
    current = current.cause
  }

  if (!chain.length) return String(error)
  if (current instanceof Error) chain.push('...')
  return chain.join('\ncaused by: ')
}

export function errorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined
}
