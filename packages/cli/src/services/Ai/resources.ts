import { Effect } from 'effect'

import { AiRecordNotFound } from '../../domain/errors'
import type { ApiError, ApiService } from '../Api'
import { asRecord, unwrapData } from './shared'
import type { AiByArticleOptions, AiListQuery } from './types'

export const makeList =
  (api: ApiService) =>
  <Q extends AiListQuery>(
    base: string,
    flatPath: string | null,
    groupedPath: string,
  ) =>
  (q: Q): Effect.Effect<unknown, ApiError> =>
    api.request(
      q.grouped || flatPath === null
        ? `${base}${groupedPath}`
        : `${base}${flatPath}`,
      {
        query: {
          page: q.page,
          size: q.size,
          search: q.search,
        },
      },
    )

const groupedItems = (
  group: unknown,
  itemKeys: ReadonlyArray<string>,
): ReadonlyArray<unknown> => {
  const record = asRecord(group)
  for (const key of itemKeys) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }
  return []
}

export const makeMatchById =
  (api: ApiService) =>
  (
    base: string,
    id: string,
    itemKeys: ReadonlyArray<string>,
  ): Effect.Effect<unknown, AiRecordNotFound | ApiError> =>
    Effect.gen(function* () {
      // Try grouped pagination; flatten and match by id. Capped scan to avoid
      // unbounded pagination on enormous datasets.
      const MAX_PAGES = 50
      const SIZE = 50
      for (let page = 1; page <= MAX_PAGES; page++) {
        const raw = yield* api.request(`${base}/grouped`, {
          query: { page, size: SIZE },
        })
        const data = unwrapData(raw)
        const groups = Array.isArray(data) ? data : []
        for (const group of groups) {
          for (const item of groupedItems(group, itemKeys)) {
            const r = asRecord(item)
            if (typeof r.id === 'string' && r.id === id) return item
          }
        }
        const pagination = asRecord(asRecord(asRecord(raw).meta).pagination)
        const totalPages =
          typeof pagination.totalPages === 'number'
            ? pagination.totalPages
            : groups.length < SIZE
              ? page
              : page + 1
        if (page >= totalPages) break
      }
      return yield* Effect.fail(
        new AiRecordNotFound({
          message: `AI record not found: ${id}`,
          ref: id,
        }),
      )
    })

export const makeByArticle =
  (api: ApiService) =>
  (base: string) =>
  (
    refId: string,
    opts?: AiByArticleOptions,
  ): Effect.Effect<unknown, ApiError> =>
    api.request(`${base}/article/${refId}`, {
      query: {
        lang: opts?.lang,
        onlyDb: opts?.onlyDb,
      },
    })
