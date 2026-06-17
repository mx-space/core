import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'

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
  const path = `${apiRoutePrefix}/s/sk/${row.name}`
  const rawUrl = base ? `${base}${path}` : path
  return {
    id: String(row.id),
    name: row.name,
    description: row.comment ?? '',
    rawUrl,
    raw: row.raw,
  }
}
