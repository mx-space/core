import { FileText, Plus } from 'lucide-react'

import { useI18n } from '~/i18n'
import { ButtonLink } from '~/ui/primitives/button'

export function PostsEmpty(props: { keyword: string }) {
  const { t } = useI18n()
  const hasSearch = Boolean(props.keyword)

  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <FileText aria-hidden="true" className="size-8 text-neutral-300" />
      <p className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {hasSearch ? t('posts.empty.hasSearch.title') : t('posts.empty.title')}
      </p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {hasSearch
          ? t('posts.empty.hasSearch.description')
          : t('posts.empty.description')}
      </p>
      {!hasSearch ? (
        <ButtonLink className="mt-4" to="/posts/edit" variant="subtle">
          <Plus aria-hidden="true" className="size-4" />
          {t('posts.empty.create')}
        </ButtonLink>
      ) : null}
    </div>
  )
}
