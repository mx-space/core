import type { SnippetRow } from './snippet.types'

export type PublicSkillView = {
  id: string
  name: string
  description: string
  rawUrl: string
  raw: string
}

export function toPublicSkillView(
  row: SnippetRow,
  serverUrl: string,
): PublicSkillView {
  const base = serverUrl.replace(/\/$/, '')
  const rawUrl = base ? `${base}/s/${row.path}` : `/s/${row.path}`
  return {
    id: String(row.id),
    name: deriveSkillName(row.path),
    description: row.comment ?? '',
    rawUrl,
    raw: row.raw,
  }
}

export function deriveSkillName(path: string): string {
  const segments = path.split('/')
  return segments.at(-2) ?? ''
}
