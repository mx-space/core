import { useQuery } from '@tanstack/react-query'

import { getReaderStats } from '~/api/readers'
import { adminQueryKeys } from '~/query/keys'

export function useReaderStats() {
  return useQuery({
    queryFn: getReaderStats,
    queryKey: adminQueryKeys.readers.stats(),
  })
}
