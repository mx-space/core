import { Sparkles } from 'lucide-react'

import { EmptyState } from '~/ui/patterns/EmptyState'

interface ArticleDetailEmptyStateProps {
  title: string
  description: string
}

export function ArticleDetailEmptyState(props: ArticleDetailEmptyStateProps) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center">
      <EmptyState
        description={props.description}
        icon={Sparkles}
        title={props.title}
      />
    </div>
  )
}
