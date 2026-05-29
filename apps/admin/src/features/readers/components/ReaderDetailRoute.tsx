import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { findInListCache } from '~/api/list-cache'
import type { ReaderModel } from '~/api/readers'
import { getReader } from '~/api/readers'

import { readersQueryKey } from '../constants'
import { ReaderDetailEmpty } from './ReaderDetailEmpty'
import { useReadersRouteContext } from './readers-route-context'
import { ReadersDetailPane } from './ReadersDetailPane'

const LIST_PREFIX = [...readersQueryKey, 'list'] as const

function extractReaders(value: unknown): ReaderModel[] | undefined {
  if (!value || typeof value !== 'object') return undefined
  const data = (value as { data?: unknown }).data
  return Array.isArray(data) ? (data as ReaderModel[]) : undefined
}

export function ReaderDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const ctx = useReadersRouteContext()

  const initialReader = id
    ? findInListCache<ReaderModel>(queryClient, LIST_PREFIX, id, {
        extractItems: extractReaders,
      })
    : undefined

  const detailQuery = useQuery({
    enabled: Boolean(id),
    initialData: initialReader,
    queryFn: () => getReader(id as string),
    queryKey: [...readersQueryKey, 'detail', id],
    staleTime: initialReader ? 30_000 : 0,
  })

  if (!id) return <ReaderDetailEmpty />

  const reader = detailQuery.data
  if (!reader) {
    if (detailQuery.isLoading) return <ReaderDetailEmpty />
    return <ReaderDetailEmpty />
  }

  return (
    <ReadersDetailPane
      currentUserId={ctx.currentUserId}
      isLoading={detailQuery.isLoading && !reader}
      mutations={ctx.mutations}
      onBack={ctx.onBack}
      reader={reader}
    />
  )
}

export default ReaderDetailRoute
