export function parseLexicalTopLevelBlocks(content: string): unknown[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content) as { root?: { children?: unknown[] } }
    return Array.isArray(parsed.root?.children) ? parsed.root.children : []
  } catch {
    return []
  }
}

export function collectLexicalText(node: unknown): string {
  if (typeof node !== 'object' || node === null) return ''
  const record = node as Record<string, unknown>
  if (typeof record.text === 'string') return record.text
  return Array.isArray(record.children)
    ? record.children.map(collectLexicalText).join('')
    : ''
}
