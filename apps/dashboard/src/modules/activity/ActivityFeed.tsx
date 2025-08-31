import type { FC } from 'react'

import { useActivitySocket } from '~/hooks/useActivitySocket'

import { ActivityItem } from './ActivityItem'

export const ActivityFeed: FC = () => {
  const { activities, loadMore } = useActivitySocket()

  return (
    <div className="space-y-3">
      {activities.map((item) => (
        <ActivityItem key={item.id} item={item} />
      ))}

      <button
        type="button"
        className="mt-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-fill"
        onClick={() => void loadMore()}
      >
        Load More
      </button>
    </div>
  )
}
