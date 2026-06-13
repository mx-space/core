import { X } from 'lucide-react'

import { useI18n } from '~/i18n'

import type { ArticleGroupedConfig } from './types'

interface ArticleEditPanelProps<TItem> {
  config: ArticleGroupedConfig<TItem>
  editingItem: TItem
  updateSubmitting: boolean
  onClose: () => void
  onUpdate: (next: TItem) => Promise<void>
}

export function ArticleEditPanel<TItem>(props: ArticleEditPanelProps<TItem>) {
  const { t } = useI18n()
  const { config } = props

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface-card">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <h3 className="truncate text-sm font-medium text-fg">
          {t(config.editTitleKey)}
        </h3>
        <button
          aria-label={t('ui.modal.closeAria')}
          className="inline-flex size-8 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg"
          onClick={props.onClose}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1">
        <config.EditDrawerBody
          item={props.editingItem}
          key={config.getId(props.editingItem)}
          onCancel={props.onClose}
          onSubmit={props.onUpdate}
          submitting={props.updateSubmitting}
        />
      </div>
    </section>
  )
}
