import type { View } from '../../services/Renderer/view'
import { ANSI, dim, renderTable, wrap } from '../ui'

export interface ProfileListRow {
  readonly current: string
  readonly name: string
  readonly api_url: string
  readonly production: string
}

export const profileListView: View<readonly ProfileListRow[]> = {
  kind: 'profile-list',
  modes: new Set(['readable', 'llm']),
  readable: (rows, { color }) => {
    if (rows.length === 0) return ''
    return renderTable(
      [
        { key: 'name', label: 'profile' },
        { key: 'api_url', label: 'api url' },
        { key: 'production', label: 'prod' },
      ],
      rows.map((r) => ({
        name: r.current === '*' ? wrap(ANSI.bold, r.name, color) : r.name,
        api_url: r.api_url || dim('—', color),
        production: r.production === 'yes' ? 'yes' : dim('—', color),
      })),
      {
        color,
        prefix: (i) =>
          rows[i].current === '*' ? wrap(ANSI.cyan, '●', color) : ' ',
      },
    )
  },
}
