export function stripTopLevelCodeFence(text: string): string {
  const trimmed = text.trim()
  const openMatch = /^```(?:markdown)?\n/.exec(trimmed)
  if (!openMatch) return text
  if (!trimmed.endsWith('```')) return text
  const inner = trimmed.slice(openMatch[0].length, -3)
  return inner.replace(/\n$/, '')
}
