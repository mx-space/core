import { ArrowLeft, Loader2, Plus } from 'lucide-react'
import { Link } from 'react-router'

import type { ArticleInfo } from '~/api/ai'
import { useI18n } from '~/i18n'
import { FocusScope } from '~/ui/focus-scope'
import type { ListAction } from '~/ui/list-actions'
import { useListKeyboard } from '~/ui/list-actions'
import type { ContextMenuItem } from '~/ui/overlay/context-menu'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { ItemRow } from './ItemRow'
import { getRefTypeMeta } from './refTypeMeta'
import type { ArticleGroupedConfig } from './types'

interface ArticleDetailPaneProps<TItem> {
  config: ArticleGroupedConfig<TItem>
  article: ArticleInfo
  items: TItem[]
  isLoading: boolean
  onBack: () => void
  onGenerate: () => void
  onEdit: (item: TItem) => void
  onDelete: (item: TItem) => void
  /** Fires on keyboard focus traversal (j/k/arrow). Use to sync external state (e.g. open-drawer target). */
  onItemFocus?: (item: TItem) => void
  keyboardActions: ReadonlyArray<ListAction<TItem>>
  buildMenu: (item: TItem) => ContextMenuItem[]
}

export function ArticleDetailPane<TItem>(props: ArticleDetailPaneProps<TItem>) {
  const { t } = useI18n()
  const scopeId = `${props.config.scopeIdPrefix}-items`
  const meta = getRefTypeMeta(props.article.type)
  const TypeIcon = meta.icon
  const editPath = meta.editPath?.(props.article.id) ?? null
  const GenerateIcon = props.config.generate.icon ?? Plus

  const { selection } = useListKeyboard<TItem>({
    scopeId,
    items: props.items,
    getId: props.config.getId,
    resetOn: [props.article.id],
    actions: props.keyboardActions,
    onItemFocus: (id) => {
      selection.selectOne(id)
      const item = props.items.find((it) => props.config.getId(it) === id)
      if (item) props.onItemFocus?.(item)
    },
  })

  const articleTitleNode = (
    <span className="inline-flex min-w-0 items-center gap-2">
      <TypeIcon
        aria-hidden="true"
        className="size-5 shrink-0 text-neutral-400"
      />
      <span className="truncate text-sm font-semibold text-neutral-950 dark:text-neutral-50">
        {props.article.title || t(meta.labelKey)}
      </span>
    </span>
  )

  return (
    <FocusScope
      className={cn(
        'outline-hidden flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950',
      )}
      id={scopeId}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800">
        <div className="flex min-w-0 items-center gap-2">
          <button
            aria-label={t('common.back')}
            className="inline-flex size-8 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 lg:hidden dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
            onClick={props.onBack}
            type="button"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </button>
          <h2 className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
            {t(props.config.detailSectionTitleKey)}
          </h2>
        </div>
        <Button onClick={props.onGenerate} type="button" variant="subtle">
          <GenerateIcon aria-hidden="true" className="size-4" />
          {t(props.config.generate.labelKey)}
        </Button>
      </div>

      <Scroll className="flex-1" innerClassName="p-4">
        {editPath ? (
          <Link
            className="inline-flex max-w-full items-center gap-2 transition-colors hover:text-blue-600 dark:hover:text-blue-400"
            to={editPath}
          >
            {articleTitleNode}
          </Link>
        ) : (
          <div className="inline-flex max-w-full">{articleTitleNode}</div>
        )}

        <div className="my-4 h-px bg-neutral-100 dark:bg-neutral-800" />

        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t(props.config.detailSectionTitleKey)}
          </h3>
          <span className="text-xs text-neutral-400">
            {t(props.config.itemCountKey, { count: props.items.length })}
          </span>
        </div>

        {props.isLoading && props.items.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2
              aria-hidden="true"
              className="size-5 animate-spin text-neutral-400"
            />
          </div>
        ) : props.items.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-3 rounded border border-dashed border-neutral-200 px-4 py-8 text-center dark:border-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t(props.config.inlineEmptyKey, {
                kind: t(props.config.kindKey),
              })}
            </p>
            <Button onClick={props.onGenerate} type="button" variant="subtle">
              <GenerateIcon aria-hidden="true" className="size-4" />
              {t(props.config.generate.labelKey)}
            </Button>
          </div>
        ) : (
          <div className="-mx-4 mt-3">
            {props.items.map((item) => {
              const id = props.config.getId(item)
              return (
                <ItemRow<TItem>
                  buildMenu={props.buildMenu}
                  createdAt={props.config.getCreatedAt(item)}
                  id={id}
                  item={item}
                  key={id}
                  lang={props.config.getLang(item)}
                  onDelete={() => props.onDelete(item)}
                  onSelect={(mode) => {
                    if (mode === 'toggle') selection.toggle(id)
                    else if (mode === 'range') selection.selectRange(id)
                    else {
                      selection.selectOne(id)
                      props.onEdit(item)
                    }
                  }}
                  preview={props.config.getPreview(item)}
                  selected={selection.isSelected(id)}
                />
              )
            })}
          </div>
        )}
      </Scroll>
    </FocusScope>
  )
}
