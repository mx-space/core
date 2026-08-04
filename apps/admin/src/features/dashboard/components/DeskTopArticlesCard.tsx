import type { TopArticle } from '~/api/aggregate'
import { useI18n } from '~/i18n'

import { DeskCard, DeskRow } from './DeskCard'

export function DeskTopArticlesCard(props: { articles: TopArticle[] }) {
  const { format, t } = useI18n()
  if (props.articles.length === 0) return null

  return (
    <DeskCard title={t('dashboard.desk.topArticles.title')}>
      {props.articles.slice(0, 5).map((article, index) => (
        <DeskRow
          key={article.id}
          to={`/posts/edit?id=${encodeURIComponent(article.id)}`}
        >
          <span className="w-5 shrink-0 text-xs tabular-nums text-fg-subtle">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-fg">
            {article.title}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-fg-muted">
            {t('dashboard.desk.topArticles.reads', {
              count: format.number(article.reads),
            })}
          </span>
        </DeskRow>
      ))}
    </DeskCard>
  )
}
