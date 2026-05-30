import { Inbox, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { ArticleInfo } from '~/api/ai'
import { useI18n } from '~/i18n'
import { FocusScope } from '~/ui/focus-scope'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import type { HeaderAction } from '~/ui/layout/page-layout'
import { HeaderActions } from '~/ui/layout/page-layout'
import { useListKeyboard } from '~/ui/list-actions'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { ArticleListRow } from './ArticleListRow'
import { BorderlessSearchInput } from './BorderlessSearchInput'
import type { ArticleGroup, ArticleGroupedConfig } from './types'

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
  actions?: HeaderAction[]
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
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border pl-1 pr-2">
        <MobileHeaderAffordance />
        <BorderlessSearchInput
          ariaLabel={t(props.config.searchPlaceholderKey)}
          onChange={props.onSearchChange}
          placeholder={t(props.config.searchPlaceholderKey)}
          value={props.search}
        />
        {props.actions?.length ? (
          <HeaderActions actions={props.actions} />
        ) : null}
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
                    className="size-4 animate-spin text-fg-subtle"
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
      <Inbox aria-hidden="true" className="size-8 text-fg-subtle" />
      <p className="text-sm font-medium text-fg">{props.title}</p>
      <p className="text-xs text-fg-muted">{props.description}</p>
    </div>
  )
}
