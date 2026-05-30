import { useI18n } from '~/i18n'
import { Panel } from '~/ui/primitives/panel'

import { formatNumber } from '../utils/dashboard'
import { EmptyDashboardBlock } from './DashboardPrimitives'

export function TopArticlesPanel(props: {
  articles: Array<{ id: string; likes: number; reads: number; title: string }>
}) {
  const { t } = useI18n()
  return (
    <Panel title={t('dashboard.topArticles.title')}>
      <div className="divide-y divide-border">
        {props.articles.length === 0 ? (
          <EmptyDashboardBlock />
        ) : (
          props.articles.slice(0, 8).map((article) => (
            <div
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              key={article.id}
            >
              <span className="min-w-0 truncate text-fg">{article.title}</span>
              <span className="shrink-0 text-xs tabular-nums text-fg-muted">
                {t('dashboard.topArticles.stats', {
                  likes: formatNumber(article.likes),
                  reads: formatNumber(article.reads),
                })}
              </span>
            </div>
          ))
        )}
      </div>
    </Panel>
  )
}
