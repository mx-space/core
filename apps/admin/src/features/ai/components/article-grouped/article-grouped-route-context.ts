import { createContext, useContext } from 'react'

import type { ArticleGroupedConfig } from './types'

export interface ArticleGroupedRouteContextValue<TItem = unknown> {
  basePath: string
  config: ArticleGroupedConfig<TItem>
  onBack: () => void
  invalidate: () => Promise<void>
}

export const ArticleGroupedRouteContext =
  createContext<ArticleGroupedRouteContextValue<unknown> | null>(null)

export function useArticleGroupedRouteContext<
  TItem,
>(): ArticleGroupedRouteContextValue<TItem> {
  const ctx = useContext(ArticleGroupedRouteContext)
  if (!ctx) {
    throw new Error(
      'useArticleGroupedRouteContext must be used inside <ArticleGroupedRouteContext.Provider>',
    )
  }
  return ctx as unknown as ArticleGroupedRouteContextValue<TItem>
}
