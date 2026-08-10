import { useNavigate, useParams } from 'react-router'

import { useI18n } from '~/i18n'

import { ArticleDetailEmptyState } from '../article-grouped/ArticleDetailEmptyState'
import { OverviewDetailPane } from './OverviewDetailPane'

export function OverviewDetailRoute() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) {
    return (
      <ArticleDetailEmptyState
        description={t('ai.overview.detailEmptyDescription')}
        title={t('ai.overview.detailEmptyTitle')}
      />
    )
  }

  return (
    <OverviewDetailPane onBack={() => navigate('/ai/overview')} refId={id} />
  )
}
