import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import type { SearchIndexRefType } from '~/api/search-index'
import { getSearchIndexDocuments } from '~/api/search-index'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import { adminQueryKeys } from '~/query/keys'

import { searchIndexPageSizeOptions } from '../constants'

const KEYWORD_DEBOUNCE_MS = 350
const REF_TYPE_VALUES = new Set<string>(['note', 'page', 'post'])

interface SearchIndexListState {
  keyword: string
  lang: string
  page: number
  pageSize: number
  refType: SearchIndexRefType | ''
}

export function useSearchIndexDocuments() {
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams): SearchIndexListState => ({
        keyword: searchParams.get('q') ?? '',
        lang: searchParams.get('lang') ?? '',
        page: clampPositive(searchParams.get('page'), 1),
        pageSize: clampPageSize(searchParams.get('size')),
        refType: parseRefType(searchParams.get('type')),
      }),
      write: (state: SearchIndexListState) => {
        const nextParams = new URLSearchParams()
        if (state.keyword) nextParams.set('q', state.keyword)
        if (state.lang) nextParams.set('lang', state.lang)
        if (state.refType) nextParams.set('type', state.refType)
        if (state.page > 1) nextParams.set('page', String(state.page))
        if (state.pageSize !== searchIndexPageSizeOptions[0]) {
          nextParams.set('size', String(state.pageSize))
        }
        return nextParams
      },
    }),
    [],
  )

  const [state, setState] = useUrlListState(urlStateOptions)
  const [keywordInput, setKeywordInput] = useState(state.keyword)

  useEffect(() => {
    setKeywordInput(state.keyword)
  }, [state.keyword])

  useEffect(() => {
    const trimmed = keywordInput.trim()
    if (trimmed === state.keyword) return
    const timer = window.setTimeout(() => {
      setState((current) => ({ ...current, keyword: trimmed, page: 1 }))
    }, KEYWORD_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [keywordInput, setState, state.keyword])

  const queryParams = {
    keyword: state.keyword || undefined,
    lang: state.lang || undefined,
    page: state.page,
    refType: state.refType || undefined,
    size: state.pageSize,
  }

  const documentsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getSearchIndexDocuments(queryParams),
    queryKey: adminQueryKeys.searchIndex.documents(queryParams),
  })

  const listSearchParams = urlStateOptions.write(state)
  const listQueryString = listSearchParams.toString()

  return {
    documentsQuery,
    keyword: state.keyword,
    keywordInput,
    langFilter: state.lang,
    listQueryString,
    page: state.page,
    pageCount: documentsQuery.data?.pagination.totalPage ?? 1,
    pageSize: state.pageSize,
    refTypeFilter: state.refType,
    rows: documentsQuery.data?.data ?? [],
    setKeywordInput,
    setLangFilter: (lang: string) =>
      setState((current) => ({ ...current, lang: lang.trim(), page: 1 })),
    setPage: (page: number) => setState({ page }),
    setPageSize: (pageSize: number) =>
      setState((current) => ({ ...current, page: 1, pageSize })),
    setRefTypeFilter: (refType: SearchIndexRefType | '') =>
      setState((current) => ({ ...current, page: 1, refType })),
    total: documentsQuery.data?.pagination.total ?? 0,
  }
}

function parseRefType(raw: string | null): SearchIndexRefType | '' {
  if (raw && REF_TYPE_VALUES.has(raw)) return raw as SearchIndexRefType
  return ''
}

function clampPositive(raw: string | null, fallback: number): number {
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return parsed
}

function clampPageSize(raw: string | null): number {
  const parsed = clampPositive(raw, searchIndexPageSizeOptions[0])
  if (
    searchIndexPageSizeOptions.includes(
      parsed as (typeof searchIndexPageSizeOptions)[number],
    )
  ) {
    return parsed
  }
  return searchIndexPageSizeOptions[0]
}
