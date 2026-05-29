import { Inbox, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ArticleInfo } from '~/api/ai'
import type { ArticleGroup, ArticleGroupedConfig } from './types'

import { useI18n } from '~/i18n'
import { FocusScope } from '~/ui/focus-scope'
import { useListKeyboard } from '~/ui/list-actions'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { ArticleListRow } from './ArticleListRow'
import { BorderlessSearchInput } from './BorderlessSearchInput'

interface ArticleListPaneProps<TItem> {
  config: ArticleGroupedConfig<TItem>
  search: string
  onSearchChange: (value: string) => void
  groups: ArticleGroup<TItem>[]
  selectedArticleId: string | null
  onSelectArticle: (article: ArticleInfo) => void
  isLoading: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}

export function ArticleListPane<TItem>(props: ArticleListPaneProps<TItem>) {
  const { t } = useI18n()
  const scopeId = `${props.config.scopeIdPrefix}-articles`
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const articles = props.groups.map((group) => group.article)

  useListKeyboard<ArticleInfo>({
    scopeId,
    items: articles,
    getId: (article) => article.id,
    resetOn: [props.search],
    onItemFocus: (id) => {
      const article = articles.find((a) => a.id === id)
      if (article) props.onSelectArticle(article)
    },
    actions: [
      {
        key: 'open',
        label: 'Open',
        shortcut: 'Enter',
        run: (targets) => {
          const target = targets[0]
          if (target) props.onSelectArticle(target)
        },
      },
    ],
  })

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    if (!props.hasNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((entry) => entry.isIntersecting) &&
          !props.isFetchingNextPage
        ) {
          props.onLoadMore()
        }
      },
      { root: scrollRef.current, rootMargin: '240px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [props.hasNextPage, props.isFetchingNextPage, props.onLoadMore])

  const empty = !props.isLoading && props.groups.length === 0
  const hasSearch = props.search.trim().length > 0

  return (
    <FocusScope
      className={cn('outline-hidden flex h-full min-h-0 flex-col')}
      id={scopeId}
    >
      <div className="flex h-12 shrink-0 items-center border-b border-neutral-200 px-1 dark:border-neutral-800">
        <BorderlessSearchInput
          ariaLabel={t(props.config.searchPlaceholderKey)}
          onChange={props.onSearchChange}
          placeholder={t(props.config.searchPlaceholderKey)}
          value={props.search}
        />
      </div>

      <Scroll className="flex-1" ref={scrollRef}>
        {empty ? (
          <ListEmpty
            description={
              hasSearch
                ? t('ai.articleGrouped.searchEmptyHint')
                : t(props.config.emptyDescriptionKey)
            }
            title={
              hasSearch
                ? t('ai.articleGrouped.searchEmptyTitle')
                : t(props.config.emptyTitleKey, {
                    kind: t(props.config.kindKey),
                  })
            }
          />
        ) : (
          <>
            {props.groups.map((group) => (
              <ArticleListRow
                article={group.article}
                isDetailTarget={props.selectedArticleId === group.article.id}
                itemCount={group.items.length}
                itemCountKey={props.config.itemCountKey}
                key={`${group.article.type}-${group.article.id}`}
                onSelect={() => props.onSelectArticle(group.article)}
                selected={props.selectedArticleId === group.article.id}
              />
            ))}
            {props.hasNextPage ? (
              <div
                className="flex items-center justify-center py-3"
                ref={sentinelRef}
              >
                {props.isFetchingNextPage ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-4 animate-spin text-neutral-400"
                  />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </Scroll>
    </FocusScope>
  )
}

function ListEmpty(props: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
      <Inbox aria-hidden="true" className="size-8 text-neutral-400" />
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {props.title}
      </p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {props.description}
      </p>
    </div>
  )
}
