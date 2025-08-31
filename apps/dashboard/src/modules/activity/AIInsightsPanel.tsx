import type { FC } from 'react'

interface InsightItem {
  id: string
  text: string
}

export const AIInsightsPanel: FC = () => {
  // Placeholder for integration with react-query
  const insights: InsightItem[] = [
    { id: '1', text: 'Weekly Growth: +8%' },
    { id: '2', text: 'Hot Topic: Next.js' },
    { id: '3', text: '3 AI suggestions available' },
  ]

  return (
    <div className="bg-gradient-to-r from-accent/5 to-accent/10 border border-accent/20 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <i className="i-mingcute-magic-line text-accent w-5 h-5" />
        <h3 className="font-medium text-text">AI Insights</h3>
        <span className="ml-auto bg-accent/20 text-accent text-xs px-2 py-1 rounded-full">
          Preview
        </span>
      </div>
      <div className="space-y-3">
        {insights.map((insight) => (
          <div key={insight.id} className="bg-background/50 rounded-lg p-4">
            <div className="text-sm text-text">{insight.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
