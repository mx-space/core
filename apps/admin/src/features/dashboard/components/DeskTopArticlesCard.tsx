import type { TopArticle } from '~/api/aggregate'
import { useI18n } from '~/i18n'

import { DeskItem, DeskSectionTitle } from './DeskSection'

export function DeskTopArticlesCard(props: { articles: TopArticle[] }) {
  const { format, t } = useI18n()

  return (
    <section className="min-w-0">
      <DeskSectionTitle title={t('dashboard.desk.topArticles.title')} />
      {props.articles.slice(0, 5).map((article, index) => (
        <DeskItem
          className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-baseline gap-2.5 py-2.5"
          key={article.id}
          to={`/posts/edit?id=${encodeURIComponent(article.id)}`}
        >
          <span className="text-xs tabular-nums text-fg-subtle">
            {index + 1}
          </span>
          <span className="truncate text-sm text-fg transition-colors group-hover:text-accent">
            {article.title}
          </span>
          <span className="text-xs tabular-nums text-fg-subtle">
            {t('dashboard.desk.topArticles.reads', {
              count: format.number(article.reads),
            })}
          </span>
        </DeskItem>
      ))}
    </section>
  )
}
