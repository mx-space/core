import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getContentUsage } from '~/api/content-usage'
import type { DynamicCatalog } from '~/api/dynamic-components'
import type { OrphanFile } from '~/api/files'
import { getOrphanFiles } from '~/api/files'
import { adminQueryKeys } from '~/query/keys'

import { classifyDynamicComponents } from '../utils/component-usage'

const ORPHAN_PAGE_SIZE = 100
const ORPHAN_PAGE_LIMIT = 50

async function getAllOrphanFiles() {
  const files: OrphanFile[] = []
  for (let page = 1; page <= ORPHAN_PAGE_LIMIT; page++) {
    const result = await getOrphanFiles(page, ORPHAN_PAGE_SIZE)
    files.push(...result.data)
    if (!result.pagination.hasNextPage) break
  }
  return files
}

export function useComponentUsage(catalog: DynamicCatalog | undefined) {
  const urls = useMemo(
    () =>
      (catalog?.components ?? []).flatMap((entry) => [
        entry.url,
        ...(entry.previousUrls ?? []),
      ]),
    [catalog],
  )
  return useQuery({
    enabled: Boolean(catalog),
    queryFn: async () => {
      const [usage, orphanFiles] = await Promise.all([
        urls.length ? getContentUsage(urls) : [],
        getAllOrphanFiles(),
      ])
      return classifyDynamicComponents({
        catalog: catalog!,
        orphanFiles,
        usage,
      })
    },
    queryKey: adminQueryKeys.dynamicComponents.usage(urls),
  })
}
