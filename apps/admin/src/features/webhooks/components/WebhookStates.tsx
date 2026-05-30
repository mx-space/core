import { Plus, Webhook } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Button } from '~/ui/primitives/button'

export function WebhookListSkeleton() {
  return (
    <div className="animate-pulse">
      {[1, 2, 3, 4].map((index) => (
        <div
          className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-900"
          key={index}
        >
          <div className="size-2 rounded-full bg-neutral-200 dark:bg-neutral-700" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-48 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="mt-2 h-3 w-28 rounded bg-neutral-100 dark:bg-neutral-800" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function WebhookListEmptyState(props: { onCreate: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center py-24">
      <EmptyState
        action={
          <Button onClick={props.onCreate} type="button">
            <Plus aria-hidden="true" className="size-4" />
            {t('webhooks.empty.create')}
          </Button>
        }
        description={t('webhooks.empty.description')}
        icon={Webhook}
        title={t('webhooks.empty.title')}
      />
    </div>
  )
}

export function WebhookDetailEmptyState() {
  const { t } = useI18n()
  return (
    <div className="flex h-full items-center justify-center bg-surface-card">
      <EmptyState
        description={t('webhooks.detailEmpty.description')}
        icon={Webhook}
        title={t('webhooks.detailEmpty.title')}
      />
    </div>
  )
}
