import { Sparkles } from 'lucide-react'

interface ArticleDetailEmptyStateProps {
  title: string
  description: string
}

export function ArticleDetailEmptyState(props: ArticleDetailEmptyStateProps) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-white dark:bg-neutral-950">
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <Sparkles aria-hidden="true" className="size-8 text-neutral-400" />
        </div>
        <p className="text-base font-medium text-neutral-900 dark:text-neutral-50">
          {props.title}
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {props.description}
        </p>
      </div>
    </div>
  )
}
