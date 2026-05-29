import { useQuery } from '@tanstack/react-query'

import { getReaderStats } from '~/api/readers'

import { readersQueryKey } from '../constants'

export function useReaderStats() {
  return useQuery({
    queryFn: getReaderStats,
    queryKey: [...readersQueryKey, 'stats'],
  })
}
