import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'

import type { DynamicCatalog } from '~/api/dynamic-components'
import { getDynamicComponents } from '~/api/dynamic-components'
import { adminQueryKeys } from '~/query/keys'
import { primeDynamicCatalog } from '~/vendor/rich-editor/utils/dynamic-catalog'

import type { DynamicComponentItem } from '../types/dynamic-components'

const catalogQueryKey = adminQueryKeys.dynamicComponents.list()

export function useDynamicCatalog() {
  const query = useQuery({
    queryFn: getDynamicComponents,
    queryKey: catalogQueryKey,
  })

  useEffect(() => {
    if (query.data) primeDynamicCatalog(query.data)
  }, [query.data])

  const items = useMemo(
    () =>
      (query.data?.components ?? []).filter(
        (entry): entry is DynamicComponentItem => Boolean(entry.id),
      ),
    [query.data],
  )

  return { items, query }
}

export function useApplyDynamicCatalog() {
  const queryClient = useQueryClient()
  return useCallback(
    (catalog: DynamicCatalog) => {
      queryClient.setQueryData(catalogQueryKey, catalog)
      primeDynamicCatalog(catalog)
    },
    [queryClient],
  )
}
