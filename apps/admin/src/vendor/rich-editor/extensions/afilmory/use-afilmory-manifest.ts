import { useQuery } from '@tanstack/react-query'

import type { AfilmoryManifest, AfilmoryManifestPhoto } from './types'

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '')
}

async function fetchAfilmoryManifest(
  baseUrl: string,
): Promise<AfilmoryManifest> {
  const res = await fetch(`${normalizeBaseUrl(baseUrl)}/api/manifest`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch afilmory manifest (${res.status})`)
  }
  return (await res.json()) as AfilmoryManifest
}

export function useAfilmoryManifest(baseUrl: string) {
  return useQuery({
    queryKey: ['afilmory-manifest', normalizeBaseUrl(baseUrl)],
    queryFn: () => fetchAfilmoryManifest(baseUrl),
    staleTime: 1000 * 60 * 60 * 6,
    gcTime: 1000 * 60 * 60 * 12,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: Boolean(baseUrl),
  })
}

async function fetchAfilmoryPhoto(
  baseUrl: string,
  photoId: string,
): Promise<AfilmoryManifestPhoto> {
  const res = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/manifest/photos/${encodeURIComponent(photoId)}`,
    { headers: { Accept: 'application/json' } },
  )
  if (res.status === 404) {
    throw new Error(`Photo ${photoId} not found`)
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch afilmory photo (${res.status})`)
  }
  return (await res.json()) as AfilmoryManifestPhoto
}

export function useAfilmoryPhotoDirect(baseUrl: string, photoId: string) {
  return useQuery({
    queryKey: ['afilmory-photo', normalizeBaseUrl(baseUrl), photoId],
    queryFn: () => fetchAfilmoryPhoto(baseUrl, photoId),
    staleTime: 1000 * 60 * 60 * 6,
    gcTime: 1000 * 60 * 60 * 12,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: Boolean(baseUrl && photoId),
  })
}

async function fetchAfilmoryPhotosByIds(
  baseUrl: string,
  ids: string[],
): Promise<AfilmoryManifestPhoto[]> {
  if (ids.length === 0) return []
  const qs = new URLSearchParams({ ids: ids.join(',') })
  const res = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/manifest/photos?${qs.toString()}`,
    { headers: { Accept: 'application/json' } },
  )
  if (!res.ok) {
    throw new Error(`Failed to fetch afilmory photos batch (${res.status})`)
  }
  return (await res.json()) as AfilmoryManifestPhoto[]
}

export function useAfilmoryPhotosByIds(baseUrl: string, ids: string[]) {
  return useQuery({
    queryKey: ['afilmory-photos-by-ids', normalizeBaseUrl(baseUrl), ids],
    queryFn: () => fetchAfilmoryPhotosByIds(baseUrl, ids),
    staleTime: 1000 * 60 * 60 * 6,
    gcTime: 1000 * 60 * 60 * 12,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: Boolean(baseUrl) && ids.length > 0,
  })
}

export interface AfilmorySearchParams {
  tags?: string[]
  tagMode?: 'union' | 'intersection'
  cameras?: string[]
  lenses?: string[]
  rating?: number
  dateFrom?: string
  dateTo?: string
  sort?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface AfilmorySearchResponse {
  data: AfilmoryManifestPhoto[]
  total: number
}

function toSearchBody(params: AfilmorySearchParams): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (params.tags?.length) body.tags = params.tags
  if (params.tagMode) body.tagMode = params.tagMode
  if (params.cameras?.length) body.cameras = params.cameras
  if (params.lenses?.length) body.lenses = params.lenses
  if (params.rating !== undefined) body.rating = params.rating
  if (params.dateFrom) body.from = params.dateFrom
  if (params.dateTo) body.to = params.dateTo
  if (params.sort) body.sort = params.sort
  if (params.limit !== undefined) body.limit = params.limit
  if (params.offset !== undefined) body.offset = params.offset
  return body
}

async function fetchAfilmoryPhotosSearch(
  baseUrl: string,
  params: AfilmorySearchParams,
): Promise<AfilmorySearchResponse> {
  const res = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/manifest/photos/search`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toSearchBody(params)),
    },
  )
  if (!res.ok) {
    throw new Error(`Failed to search afilmory photos (${res.status})`)
  }
  return (await res.json()) as AfilmorySearchResponse
}

export function useAfilmoryPhotosSearch(
  baseUrl: string,
  params: AfilmorySearchParams,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['afilmory-photos-search', normalizeBaseUrl(baseUrl), params],
    queryFn: () => fetchAfilmoryPhotosSearch(baseUrl, params),
    staleTime: 1000 * 60 * 60 * 6,
    gcTime: 1000 * 60 * 60 * 12,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: (options.enabled ?? true) && Boolean(baseUrl),
  })
}

export { normalizeBaseUrl }
