import { Blocks, Plus } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Button } from '~/ui/primitives/button'

export function DynamicComponentListSkeleton() {
  return (
    <div className="animate-pulse">
      {[1, 2, 3, 4].map((index) => (
        <div
          className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-900"
          key={index}
        >
          <div className="size-8 rounded-sm bg-neutral-200 dark:bg-neutral-700" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-40 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="mt-2 h-3 w-56 rounded bg-neutral-100 dark:bg-neutral-800" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DynamicComponentListEmptyState(props: {
  onCreate: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center px-4 py-24">
      <EmptyState
        action={
          <Button onClick={props.onCreate} type="button">
            <Plus aria-hidden="true" className="size-4" />
            {t('dynamicComponents.add')}
          </Button>
        }
        description={t('dynamicComponents.empty.description')}
        icon={Blocks}
        title={t('dynamicComponents.empty.title')}
      />
    </div>
  )
}

export function DynamicComponentDetailEmptyState() {
  const { t } = useI18n()
  return (
    <div className="flex h-full items-center justify-center bg-surface-card">
      <EmptyState
        description={t('dynamicComponents.detailEmpty.description')}
        icon={Blocks}
        title={t('dynamicComponents.detailEmpty.title')}
      />
    </div>
  )
}
