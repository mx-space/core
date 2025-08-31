import type { FC } from 'react'

import type { ActivityItem as Item } from '~/lib/activity-types'
import { cn } from '~/lib/cn'

export interface ActivityItemProps {
  item: Item
}

export const ActivityItem: FC<ActivityItemProps> = ({ item }) => {
  return (
    <div
      className={cn(
        'bg-background hover:bg-material-thin border border-border hover:border-border/70 rounded-xl p-4 transition-all duration-200',
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-fill" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-text truncate">
            {item.author?.name ?? 'System'}
          </div>
          <div className="text-xs text-placeholder-text">
            {typeof item.timestamp === 'string'
              ? new Date(item.timestamp).toLocaleString()
              : item.timestamp.toLocaleString?.()}
          </div>
        </div>
        <span
          className={cn(
            'text-xs',
            item.type === 'comment' && 'text-blue',
            item.type === 'post' && 'text-green',
            item.type === 'system' && 'text-yellow',
            item.metadata?.importance === 'urgent' && 'text-red',
          )}
        >
          {item.type}
        </span>
      </div>

      <div className="text-base font-medium text-text mb-1">{item.title}</div>
      {item.description && (
        <div className="text-sm text-placeholder-text line-clamp-2">
          {item.description}
        </div>
      )}

      {item.actions && item.actions.length > 0 && (
        <div className="flex items-center gap-2 mt-3">
          {item.actions.map((a) => (
            <button
              type="button"
              key={a.id}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg border',
                a.type === 'primary' &&
                  'bg-accent text-background border-transparent',
                a.type === 'secondary' &&
                  'bg-transparent text-accent border-accent',
                a.type === 'destructive' &&
                  'bg-red text-background border-transparent',
              )}
              onClick={() => a.handler?.(item)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
