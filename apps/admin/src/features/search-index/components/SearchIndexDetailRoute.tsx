import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { findInListCache } from '~/api/list-cache'
import type { SearchDocumentAdminRow } from '~/api/search-index'

import { searchIndexQueryKey } from '../constants'
import { useSearchIndexRouteContext } from './search-index-route-context'
import { SearchIndexDetail } from './SearchIndexDetail'
import { SearchIndexDetailEmptyState } from './SearchIndexDetailEmptyState'

export function SearchIndexDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const ctx = useSearchIndexRouteContext()

  const row = id
    ? findInListCache<SearchDocumentAdminRow>(
        queryClient,
        searchIndexQueryKey,
        id,
      )
    : undefined

  if (!id || !row) return <SearchIndexDetailEmptyState />

  return (
    <SearchIndexDetail
      onBack={ctx.onBack}
      onRebuild={() => ctx.onRebuild(row)}
      rebuilding={ctx.isRebuilding(row.id)}
      row={row}
    />
  )
}

export default SearchIndexDetailRoute
