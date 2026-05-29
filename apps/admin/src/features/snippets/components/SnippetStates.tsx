import { Code2, Loader2 } from 'lucide-react'

import { useI18n } from '~/i18n'

export function SnippetSkeleton() {
  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
      {Array.from({ length: 8 }).map((_, index) => (
        <div className="px-4 py-3" key={index}>
          <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
        </div>
      ))}
    </div>
  )
}

export function SnippetEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <Code2 aria-hidden="true" className="size-8 text-neutral-300" />
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        {t('snippets.empty')}
      </p>
    </div>
  )
}

export function SnippetDetailLoading() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <Loader2
        aria-hidden="true"
        className="size-8 animate-spin text-neutral-300"
      />
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        {t('snippets.detail.loading')}
      </p>
    </div>
  )
}

export function SnippetDetailEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <Code2 aria-hidden="true" className="size-8 text-neutral-300" />
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        {t('snippets.detail.empty')}
      </p>
    </div>
  )
}
