import type {
  EnrichmentCaptureJoinedRow,
  EnrichmentCaptureListResponse,
  EnrichmentCaptureQuota,
  EnrichmentImage,
  EnrichmentListResponse,
  EnrichmentProbeResult,
  EnrichmentProviderMeta,
  EnrichmentResult,
  EnrichmentRow,
  EnrichmentRowDetail,
  LegacyPager,
} from '~/models/enrichment'

import { deleteJson, getJson, requestJson } from './http'

const encodeId = (id: string) => encodeURIComponent(id)

export interface GetEnrichmentListParams {
  locale?: string
  onlyFailed?: boolean
  page?: number
  size?: number
}

export interface GetEnrichmentCapturesParams {
  order?: 'asc' | 'desc'
  page?: number
  size?: number
  sort?: 'bytes' | 'created' | 'last_accessed'
}

export function resolveEnrichment(url: string, lang?: string) {
  return getJson<EnrichmentResult>('/enrichment/resolve', { lang, url })
}

export function getEnrichmentList(params: GetEnrichmentListParams = {}) {
  return getJson<EnrichmentListResponse | EnrichmentRow[]>(
    '/enrichment/admin/list',
    {
      locale: params.locale,
      onlyFailed: params.onlyFailed ? 'true' : undefined,
      page: params.page,
      size: params.size,
    },
  ).then((response) =>
    normalizeListResponse(response, params.page ?? 1, params.size ?? 20),
  )
}

export function getEnrichmentProviders() {
  return getJson<EnrichmentProviderMeta[]>('/enrichment/admin/providers')
}

export function refreshEnrichment(
  provider: string,
  externalId: string,
  locale?: string,
) {
  const query = locale ? `?lang=${encodeURIComponent(locale)}` : ''

  return requestJson<EnrichmentResult>(
    `/enrichment/admin/refresh/${encodeURIComponent(provider)}/${encodeId(externalId)}${query}`,
    { method: 'POST' },
  )
}

export function invalidateEnrichment(
  provider: string,
  externalId: string,
  locale?: string,
) {
  const query =
    locale === undefined ? '' : `?lang=${encodeURIComponent(locale)}`

  return deleteJson<void>(
    `/enrichment/admin/cache/${encodeURIComponent(provider)}/${encodeId(externalId)}${query}`,
  )
}

export function getEnrichmentById(id: string) {
  return getJson<EnrichmentRowDetail>(`/enrichment/admin/by-id/${encodeId(id)}`)
}

export function getEnrichmentCaptures(
  params: GetEnrichmentCapturesParams = {},
) {
  const sort = params.sort ?? 'last_accessed'
  const order = params.order ?? 'desc'

  return getJson<EnrichmentCaptureListResponse | EnrichmentCaptureJoinedRow[]>(
    '/enrichment/admin/captures',
    {
      order,
      page: params.page,
      size: params.size,
      sort,
    },
  ).then((response) =>
    normalizeCaptureResponse(response, params.page ?? 1, params.size ?? 20),
  )
}

export function getEnrichmentCaptureQuota() {
  return getJson<EnrichmentCaptureQuota>('/enrichment/admin/captures/quota')
}

export function deleteEnrichmentCapture(enrichmentId: string) {
  return deleteJson<void>(
    `/enrichment/admin/captures/${encodeId(enrichmentId)}`,
  )
}

export function recaptureEnrichment(enrichmentId: string) {
  return requestJson<EnrichmentImage>(
    `/enrichment/admin/captures/${encodeId(enrichmentId)}/recapture`,
    { method: 'POST' },
  )
}

export function probeEnrichment(url: string, useCache?: boolean) {
  return requestJson<EnrichmentProbeResult>('/enrichment/admin/probe', {
    body: JSON.stringify({
      url,
      ...(useCache === undefined ? {} : { useCache }),
    }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })
}

function normalizeListResponse(
  response: EnrichmentListResponse | EnrichmentRow[],
  page: number,
  size: number,
): EnrichmentListResponse {
  if (Array.isArray(response)) {
    return {
      data: response,
      pagination: fallbackPager(response.length, page, size),
    }
  }

  return response
}

function normalizeCaptureResponse(
  response: EnrichmentCaptureListResponse | EnrichmentCaptureJoinedRow[],
  page: number,
  size: number,
): EnrichmentCaptureListResponse {
  if (Array.isArray(response)) {
    return {
      data: response,
      pagination: fallbackPager(response.length, page, size),
    }
  }

  return response
}

function fallbackPager(total: number, page: number, size: number): LegacyPager {
  const totalPage = Math.max(1, Math.ceil(total / size))

  return {
    currentPage: page,
    hasNextPage: page < totalPage,
    hasPrevPage: page > 1,
    size,
    total,
    totalPage,
  }
}
