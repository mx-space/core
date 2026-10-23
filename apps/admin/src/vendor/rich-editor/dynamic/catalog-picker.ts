import type { DynamicCatalogEntry } from '~/api/dynamic-components'

export function filterCatalogEntries(
  entries: DynamicCatalogEntry[],
  query: string,
): DynamicCatalogEntry[] {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return entries
  return entries.filter(
    (entry) =>
      entry.name.toLowerCase().includes(keyword) ||
      entry.description.toLowerCase().includes(keyword),
  )
}
