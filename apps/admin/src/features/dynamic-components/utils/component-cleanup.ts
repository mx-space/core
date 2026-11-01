import type { ContentUsage } from '~/api/content-usage'
import { getContentUsage } from '~/api/content-usage'
import type {
  DynamicCatalog,
  DynamicCatalogEntry,
} from '~/api/dynamic-components'
import { mutateDynamicCatalog } from '~/api/dynamic-components'
import { batchDeleteOrphanFiles } from '~/api/files'

import type { ComponentCleanupCandidate } from './component-usage'
import { entryIdOf, usageStatus } from './component-usage'

export type ComponentCleanupSelection = ComponentCleanupCandidate[]

export interface ComponentCleanupResult {
  deleted: ComponentCleanupCandidate[]
  dropped: ComponentCleanupCandidate[]
  restored: ComponentCleanupCandidate[]
}

export interface ComponentCleanupDeps {
  deleteFiles: (ids: string[]) => Promise<{ deletedCount: number }>
  getUsage: (urls: string[]) => Promise<ContentUsage[]>
  mutateCatalog: (
    mutate: (components: DynamicCatalogEntry[]) => DynamicCatalogEntry[],
  ) => Promise<DynamicCatalog>
}

export const defaultComponentCleanupDeps: ComponentCleanupDeps = {
  deleteFiles: (ids) => batchDeleteOrphanFiles({ ids }),
  getUsage: getContentUsage,
  mutateCatalog: mutateDynamicCatalog,
}

type Removed =
  | {
      candidate: ComponentCleanupCandidate
      entry: DynamicCatalogEntry
      followingIds: string[]
      type: 'entry'
    }
  | {
      candidate: ComponentCleanupCandidate
      entryId: string
      index: number
      type: 'previousUrl'
      url: string
    }
  | {
      candidate: ComponentCleanupCandidate
      entryId: string
      parentUrl: string
      type: 'parentUrl'
    }

export async function runComponentCleanup(
  selection: ComponentCleanupSelection,
  deps: ComponentCleanupDeps = defaultComponentCleanupDeps,
): Promise<ComponentCleanupResult> {
  const recheck = indexByUrl(
    await deps.getUsage(selection.flatMap((item) => item.urls)),
  )
  const dropped: ComponentCleanupCandidate[] = []
  let kept: ComponentCleanupCandidate[] = []
  for (const item of selection) {
    const status = usageStatus(item.urls.map((url) => recheck.get(url) ?? null))
    if (status === 'unused') kept.push(refreshReferences(item, recheck))
    else dropped.push(item)
  }
  if (kept.length === 0) return { deleted: [], dropped, restored: [] }

  const removed: Removed[] = []
  const stale = new Set<ComponentCleanupCandidate>()
  await deps.mutateCatalog((components) => {
    removed.length = 0
    stale.clear()
    return removeFromCatalog(components, kept, removed, stale)
  })
  dropped.push(...stale)
  kept = kept.filter((item) => !stale.has(item))
  if (kept.length === 0) return { deleted: [], dropped, restored: [] }

  const fileIds = [...new Set(kept.flatMap((item) => item.fileReferenceIds))]
  try {
    if (fileIds.length) await deps.deleteFiles(fileIds)
  } catch (error) {
    if (removed.length)
      await deps.mutateCatalog((c) => restoreCatalog(c, removed))
    throw error
  }

  const after = indexByUrl(
    await deps.getUsage(kept.flatMap((item) => item.urls)),
  )
  const skipped = (item: ComponentCleanupCandidate) =>
    item.urls.some((url) => after.get(url)?.fileReferenceId)
  const restored = kept.filter(skipped)
  const deleted = kept.filter((item) => !skipped(item))

  const toRestore = removed.filter((item) => restored.includes(item.candidate))
  if (toRestore.length)
    await deps.mutateCatalog((components) =>
      restoreCatalog(components, toRestore),
    )

  return { deleted, dropped, restored }
}

function indexByUrl(usages: ContentUsage[]) {
  return new Map(usages.map((usage) => [usage.url, usage]))
}

function refreshReferences(
  item: ComponentCleanupCandidate,
  usage: Map<string, ContentUsage>,
): ComponentCleanupCandidate {
  if (!item.action) return item
  return {
    ...item,
    fileReferenceIds: item.urls.flatMap((url) => {
      const id = usage.get(url)?.fileReferenceId
      return id ? [id] : []
    }),
  }
}

function sameUrls(entry: DynamicCatalogEntry, urls: string[]) {
  const current = [entry.url, ...(entry.previousUrls ?? [])]
  return (
    current.length === urls.length && current.every((url) => urls.includes(url))
  )
}

function removeFromCatalog(
  components: DynamicCatalogEntry[],
  selection: ComponentCleanupCandidate[],
  removed: Removed[],
  stale: Set<ComponentCleanupCandidate>,
) {
  let next = components
  for (const candidate of selection) {
    const action = candidate.action
    if (!action) continue
    const entry = next.find((item) => entryIdOf(item) === action.entryId)
    if (!entry) continue
    if (action.type === 'entry') {
      if (!sameUrls(entry, candidate.urls)) {
        stale.add(candidate)
        continue
      }
      removed.push({
        candidate,
        entry,
        followingIds: components
          .slice(components.indexOf(entry) + 1)
          .map(entryIdOf),
        type: 'entry',
      })
      next = next.filter((item) => item !== entry)
      continue
    }
    const urlIndex = entry.previousUrls?.indexOf(action.url) ?? -1
    if (urlIndex < 0) {
      stale.add(candidate)
      continue
    }
    removed.push({
      candidate,
      entryId: action.entryId,
      index: urlIndex,
      type: 'previousUrl',
      url: action.url,
    })
    next = next.map((item) =>
      item === entry
        ? {
            ...item,
            previousUrls: item.previousUrls!.filter(
              (url) => url !== action.url,
            ),
          }
        : item,
    )
  }
  const owners = new Map<string, ComponentCleanupCandidate>()
  for (const candidate of selection) {
    if (stale.has(candidate)) continue
    for (const url of candidate.urls) owners.set(url, candidate)
  }
  return next.map((entry) => {
    const owner = entry.parentUrl ? owners.get(entry.parentUrl) : undefined
    if (!owner) return entry
    removed.push({
      candidate: owner,
      entryId: entryIdOf(entry),
      parentUrl: entry.parentUrl!,
      type: 'parentUrl',
    })
    const { parentUrl: _parentUrl, ...rest } = entry
    return rest
  })
}

function restoreCatalog(components: DynamicCatalogEntry[], removed: Removed[]) {
  const next = [...components]
  const indexOf = (entryId: string) =>
    next.findIndex((entry) => entryIdOf(entry) === entryId)
  for (const item of removed.toReversed()) {
    if (item.type === 'entry') {
      if (indexOf(entryIdOf(item.entry)) >= 0) continue
      const anchor = next.findIndex((entry) =>
        item.followingIds.includes(entryIdOf(entry)),
      )
      next.splice(anchor < 0 ? next.length : anchor, 0, item.entry)
      continue
    }
    const index = indexOf(item.entryId)
    if (index < 0) continue
    const entry = next[index]
    if (item.type === 'parentUrl') {
      if (!entry.parentUrl)
        next[index] = { ...entry, parentUrl: item.parentUrl }
      continue
    }
    const urls = [...(entry.previousUrls ?? [])]
    if (urls.includes(item.url)) continue
    urls.splice(Math.min(item.index, urls.length), 0, item.url)
    next[index] = { ...entry, previousUrls: urls }
  }
  return next
}
