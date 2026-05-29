import { useQuery } from '@tanstack/react-query'
import type { ReaderModel } from '~/api/readers'

import { getReader } from '~/api/readers'

import { readersQueryKey } from '../constants'

export function useReaderDetail(
  detailId: string | null,
  listSnapshot: ReaderModel[],
): { reader: ReaderModel | null; isLoading: boolean } {
  const detailQuery = useQuery({
    enabled: Boolean(detailId),
    queryFn: () => getReader(detailId as string),
    queryKey: [...readersQueryKey, 'detail', detailId],
  })

  if (!detailId) return { isLoading: false, reader: null }

  const fromList = listSnapshot.find((reader) => reader.id === detailId) ?? null
  const reader = detailQuery.data ?? fromList

  return { isLoading: detailQuery.isLoading && !reader, reader }
}
