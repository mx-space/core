import { FileText, Plus } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { ButtonLink } from '~/ui/primitives/button'

export function PostsEmpty(props: { keyword: string }) {
  const { t } = useI18n()
  const hasSearch = Boolean(props.keyword)

  return (
    <div className="flex min-h-[24rem] items-center justify-center px-4">
      <EmptyState
        action={
          hasSearch ? null : (
            <ButtonLink to="/posts/edit" variant="subtle">
              <Plus aria-hidden="true" className="size-4" />
              {t('posts.empty.create')}
            </ButtonLink>
          )
        }
        description={
          hasSearch
            ? t('posts.empty.hasSearch.description')
            : t('posts.empty.description')
        }
        icon={FileText}
        title={
          hasSearch ? t('posts.empty.hasSearch.title') : t('posts.empty.title')
        }
      />
    </div>
  )
}
