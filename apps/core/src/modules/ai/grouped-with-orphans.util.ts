import type { PaginationResult } from '~/processors/database/base.repository'
import { paginationOf } from '~/processors/database/base.repository'
import {
  buildRefArticleMap,
  type DatabaseService,
  type RefArticleInfo,
} from '~/processors/database/database.service'
import type { EntityId } from '~/shared/id/entity-id'

export interface BuildGroupedWithOrphansInput<TItem> {
  page: number
  size: number
  search?: string

  databaseService: DatabaseService

  fetchCandidateArticles: () => Promise<{
    posts: Array<{ id: string; title: string }>
    notes: Array<{ id: string; title: string }>
    pages?: Array<{ id: string; title: string }>
  }>

  fetchRecordsPage: (
    page: number,
    size: number,
    refIds: string[] | undefined,
  ) => Promise<PaginationResult<{ refId: EntityId | string }>>

  fetchRecordsDistinctRefIds: (
    refIds: string[] | undefined,
  ) => Promise<Array<EntityId | string>>

  fetchItemsByRefIds: (refIds: string[]) => Promise<TItem[]>

  getItemRefId: (item: TItem) => string
}

export interface GroupedWithOrphansResult<TItem> {
  data: Array<{ article: RefArticleInfo; items: TItem[] }>
  pagination: ReturnType<typeof paginationOf>
}

/**
 * Build a paginated "grouped by ref" list that includes orphan articles —
 * visible articles with zero AI records — alongside articles that have
 * records. Records-having groups are ordered first (by the underlying
 * paginated query's natural order); orphan groups follow, sorted by article
 * id descending (Snowflake monotonic ≈ creation desc).
 *
 * Callers map the returned `items` field into their own item key
 * (`summaries`, `insights`, `translations`) when shaping the controller
 * response.
 */
export async function buildGroupedWithOrphans<TItem>(
  input: BuildGroupedWithOrphansInput<TItem>,
): Promise<GroupedWithOrphansResult<TItem>> {
  const { page, size, databaseService } = input
  const search = input.search?.trim()

  const searchableRefIds = search
    ? await databaseService.findArticleIdsByTitle(search)
    : undefined

  if (search && (!searchableRefIds || searchableRefIds.length === 0)) {
    return { data: [], pagination: paginationOf(0, page, size) }
  }

  const [grouped, recordsHavingIds, candidateArticles] = await Promise.all([
    input.fetchRecordsPage(page, size, searchableRefIds),
    input.fetchRecordsDistinctRefIds(searchableRefIds),
    input.fetchCandidateArticles(),
  ])

  const recordsTotal = grouped.pagination.total
  const recordsPageIds = grouped.data.map((g) => String(g.refId))
  const recordsHavingSet = new Set(recordsHavingIds.map(String))

  const candidateMap = buildRefArticleMap({
    posts: candidateArticles.posts,
    notes: candidateArticles.notes,
    pages: candidateArticles.pages,
  })

  const candidateIds = searchableRefIds
    ? Object.keys(candidateMap).filter((id) => searchableRefIds.includes(id))
    : Object.keys(candidateMap)

  const orphanIds = candidateIds
    .filter((id) => !recordsHavingSet.has(id))
    .sort((a, b) => b.localeCompare(a))

  const total = recordsTotal + orphanIds.length

  const offset = (page - 1) * size
  let pageRecordIds = recordsPageIds
  let pageOrphanIds: string[] = []

  if (offset < recordsTotal) {
    const remaining = size - pageRecordIds.length
    if (remaining > 0) {
      pageOrphanIds = orphanIds.slice(0, remaining)
    }
  } else {
    pageRecordIds = []
    const orphanOffset = offset - recordsTotal
    pageOrphanIds = orphanIds.slice(orphanOffset, orphanOffset + size)
  }

  const allRefIds = [...pageRecordIds, ...pageOrphanIds]
  if (!allRefIds.length) {
    return { data: [], pagination: paginationOf(total, page, size) }
  }

  const [items, recordsArticleMap] = await Promise.all([
    pageRecordIds.length
      ? input.fetchItemsByRefIds(pageRecordIds)
      : Promise.resolve([] as TItem[]),
    pageRecordIds.length
      ? databaseService.getRefArticleMap(pageRecordIds)
      : Promise.resolve({} as Record<string, RefArticleInfo>),
  ])

  const itemsByRefId = items.reduce<Record<string, TItem[]>>((acc, item) => {
    const refId = input.getItemRefId(item)
    if (!acc[refId]) acc[refId] = []
    acc[refId].push(item)
    return acc
  }, {})

  const data: GroupedWithOrphansResult<TItem>['data'] = []
  for (const refId of allRefIds) {
    const article = recordsArticleMap[refId] ?? candidateMap[refId]
    if (!article) continue
    data.push({ article, items: itemsByRefId[refId] ?? [] })
  }

  return { data, pagination: paginationOf(total, page, size) }
}
