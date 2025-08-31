import type { FC } from 'react'

const actions = [
  {
    id: 'write',
    icon: 'i-mingcute-edit-2-line',
    title: 'Write New Post',
    subtitle: 'Open editor',
  },
  {
    id: 'analytics',
    icon: 'i-mingcute-chart-line',
    title: 'View Analytics',
    subtitle: 'Traffic and stats',
  },
  {
    id: 'moderate',
    icon: 'i-mingcute-comment-2-line',
    title: 'Moderate Comments',
    subtitle: 'Review queue',
  },
  {
    id: 'sync',
    icon: 'i-mingcute-refresh-2-line',
    title: 'Sync Content',
    subtitle: 'Revalidate cache',
  },
]

export const QuickActions: FC = () => {
  return (
    <div className="bg-material-thin border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <i className="i-mingcute-flash-line text-accent w-5 h-5" />
        <h3 className="text-lg font-medium text-text">Quick Actions</h3>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            className="text-left bg-background hover:bg-fill border border-border hover:border-border/70 rounded-lg p-4 transition-all"
          >
            <div className="flex items-center gap-3">
              <i className={`${a.icon} w-5 h-5 text-accent`} />
              <div className="min-w-0">
                <div className="font-medium text-text truncate">{a.title}</div>
                <div className="text-sm text-placeholder-text mt-0.5 truncate">
                  {a.subtitle}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
