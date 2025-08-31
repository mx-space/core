import { ActivityFeed } from '~/modules/activity/ActivityFeed'
import { AIInsightsPanel } from '~/modules/activity/AIInsightsPanel'
import { ContextBanner } from '~/modules/activity/ContextBanner'
import { QuickActions } from '~/modules/activity/QuickActions'

export function Component() {
  return (
    <div>
      <ContextBanner />
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
        <section>
          <h2 className="text-lg font-medium text-text mb-4">Live Activity</h2>
          <ActivityFeed />
        </section>
        <aside className="space-y-6">
          <QuickActions />
          <AIInsightsPanel />
        </aside>
      </div>
    </div>
  )
}

export const loader = () => null
