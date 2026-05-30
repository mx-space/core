import { X } from 'lucide-react'

import { useI18n } from '~/i18n'

import { GeneratePromptBody } from './GeneratePromptBody'
import type { ArticleGroupedConfig } from './types'

interface ArticleEditPanelProps<TItem> {
  config: ArticleGroupedConfig<TItem>
  mode: 'edit' | 'generate'
  editingItem: TItem | null
  selectedArticleId: string | null
  generateSubmitting: boolean
  updateSubmitting: boolean
  onClose: () => void
  onGenerate: (lang?: string) => Promise<unknown>
  onUpdate: (next: TItem) => Promise<void>
}

export function ArticleEditPanel<TItem>(props: ArticleEditPanelProps<TItem>) {
  const { t } = useI18n()
  const { config, mode } = props
  const title =
    mode === 'generate' ? t(config.generate.labelKey) : t(config.editTitleKey)

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800">
        <h3 className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
          {title}
        </h3>
        <button
          aria-label={t('ui.modal.closeAria')}
          className="inline-flex size-8 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
          onClick={props.onClose}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1">
        {mode === 'generate' && props.selectedArticleId ? (
          <GeneratePromptBody
            generateLabel={t(config.generate.labelKey)}
            inlineEmpty={t(config.inlineEmptyKey, { kind: t(config.kindKey) })}
            langLabel={t('ai.translation.langLabel')}
            onCancel={props.onClose}
            onSubmit={async ({ lang }) => {
              await props.onGenerate(lang)
            }}
            promptForLang={Boolean(config.generate.promptForLang)}
            submitting={props.generateSubmitting}
          />
        ) : mode === 'edit' && props.editingItem ? (
          <config.EditDrawerBody
            item={props.editingItem}
            key={config.getId(props.editingItem)}
            onCancel={props.onClose}
            onSubmit={props.onUpdate}
            submitting={props.updateSubmitting}
          />
        ) : null}
      </div>
    </section>
  )
}
