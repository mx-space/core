import { useAtom } from 'jotai'
import type { FC } from 'react'

import { dashboardStatsAtom } from '~/atoms/dashboard'
import { Button } from '~/components/ui/button'

interface StatsCardProps {
  title: string
  value: number | string
  change?: number
  icon: string
  color: 'blue' | 'green' | 'purple' | 'orange'
}

const StatsCard: FC<StatsCardProps> = ({
  title,
  value,
  change,
  icon,
  color,
}) => {
  const colorClasses = {
    blue: 'bg-blue/10 text-blue',
    green: 'bg-green/10 text-green',
    purple: 'bg-purple/10 text-purple',
    orange: 'bg-orange/10 text-orange',
  }

  return (
    <div className="bg-background border border-border rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-sm text-placeholder-text font-medium">{title}</p>
          <p className="text-3xl font-bold text-text">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1">
              <i
                className={`i-mingcute-${change >= 0 ? 'up' : 'down'}-line w-4 h-4 ${
                  change >= 0 ? 'text-green' : 'text-red'
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  change >= 0 ? 'text-green' : 'text-red'
                }`}
              >
                {Math.abs(change)}%
              </span>
            </div>
          )}
        </div>
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}
        >
          <i className={`${icon} w-6 h-6`} />
        </div>
      </div>
    </div>
  )
}

const QuickActions: FC = () => {
  return (
    <div className="bg-background border border-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-text mb-4">Quick Actions</h3>
      <div className="space-y-3">
        <Button variant="ghost" className="w-full justify-start">
          <i className="i-mingcute-edit-line w-4 h-4 mr-3" />
          Write New Post
        </Button>
        <Button variant="ghost" className="w-full justify-start">
          <i className="i-mingcute-chart-bar-line w-4 h-4 mr-3" />
          View Analytics
        </Button>
        <Button variant="ghost" className="w-full justify-start">
          <i className="i-mingcute-chat-3-line w-4 h-4 mr-3" />
          Moderate Comments
        </Button>
        <Button variant="ghost" className="w-full justify-start">
          <i className="i-mingcute-refresh-1-line w-4 h-4 mr-3" />
          Sync Content
        </Button>
        <Button variant="ghost" className="w-full justify-start">
          <i className="i-mingcute-magic-2-line w-4 h-4 mr-3" />
          AI Content Ideas
        </Button>
        <Button variant="ghost" className="w-full justify-start">
          <i className="i-mingcute-settings-3-line w-4 h-4 mr-3" />
          System Settings
        </Button>
      </div>
    </div>
  )
}

const RecentActivity: FC = () => {
  const activities = [
    {
      id: 1,
      type: 'comment',
      message: 'New comment on "React Best Practices"',
      author: 'Zhang San',
      time: '2m ago',
      icon: 'i-mingcute-chat-3-line',
    },
    {
      id: 2,
      type: 'draft',
      message: 'Draft "Next.js Guide" updated',
      author: 'System',
      time: '15m ago',
      icon: 'i-mingcute-file-text-line',
    },
    {
      id: 3,
      type: 'view',
      message: '50 new page views today',
      author: 'Analytics',
      time: '1h ago',
      icon: 'i-mingcute-eye-line',
    },
  ]

  return (
    <div className="bg-background border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text">Recent Activity</h3>
        <Button variant="ghost" size="sm">
          View All
        </Button>
      </div>

      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3">
            <div className="w-8 h-8 bg-fill rounded-lg flex items-center justify-center flex-shrink-0">
              <i className={`${activity.icon} w-4 h-4 text-text`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text font-medium">
                {activity.message}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-placeholder-text">
                  by {activity.author}
                </span>
                <span className="text-xs text-placeholder-text">•</span>
                <span className="text-xs text-placeholder-text">
                  {activity.time}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="flex-shrink-0">
              View
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

const AIInsights: FC = () => {
  return (
    <div className="bg-background border border-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-text mb-4">AI Insights</h3>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green/10 rounded-lg flex items-center justify-center">
            <i className="i-mingcute-chart-line-line w-4 h-4 text-green" />
          </div>
          <div>
            <p className="text-sm font-medium text-text">Weekly Growth: +8%</p>
            <p className="text-xs text-placeholder-text">Traffic increased</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-text">Hot Topics:</p>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-accent/10 text-accent text-xs rounded-full">
              React
            </span>
            <span className="px-2 py-1 bg-accent/10 text-accent text-xs rounded-full">
              TypeScript
            </span>
            <span className="px-2 py-1 bg-accent/10 text-accent text-xs rounded-full">
              Next.js
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <i className="i-mingcute-magic-2-line w-4 h-4 text-accent" />
          <span className="text-sm text-text">3 AI Suggestions available</span>
        </div>
      </div>
    </div>
  )
}

export function Component() {
  const [stats] = useAtom(dashboardStatsAtom)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Dashboard Overview</h1>
          <p className="text-placeholder-text mt-1">
            Welcome back! Here's what's happening with your blog.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">
            <i className="i-mingcute-refresh-1-line w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="primary">
            <i className="i-mingcute-download-line w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Posts"
          value={stats?.posts?.total || 42}
          change={stats?.posts?.change || 12}
          icon="i-mingcute-file-text-line"
          color="blue"
        />
        <StatsCard
          title="Comments"
          value={stats?.comments?.total || 128}
          change={stats?.comments?.change || 8}
          icon="i-mingcute-chat-3-line"
          color="green"
        />
        <StatsCard
          title="Page Views"
          value={stats?.views?.total || '2.1k'}
          change={stats?.views?.change || 15}
          icon="i-mingcute-eye-line"
          color="purple"
        />
        <StatsCard
          title="Subscribers"
          value={stats?.subscribers?.total || 89}
          change={stats?.subscribers?.change || 5}
          icon="i-mingcute-user-follow-line"
          color="orange"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <QuickActions />
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Insights */}
        <AIInsights />

        {/* Placeholder for Charts */}
        <div className="bg-background border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-text mb-4">
            Performance Chart
          </h3>
          <div className="h-48 bg-fill/50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <i className="i-mingcute-chart-line-line w-8 h-8 text-placeholder-text mb-2" />
              <p className="text-sm text-placeholder-text">Chart placeholder</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const loader = () => null
