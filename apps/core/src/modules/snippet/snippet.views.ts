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
  const rawUrl = base
    ? `${base}/api/v3/s/sk/${row.name}`
    : `/api/v3/s/sk/${row.name}`
  return {
    id: String(row.id),
    name: row.name,
    description: row.comment ?? '',
    rawUrl,
    raw: row.raw,
  }
}
