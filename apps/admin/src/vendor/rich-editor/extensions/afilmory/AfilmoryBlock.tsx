import { Camera, Images, Loader2 } from 'lucide-react'
import { useMemo } from 'react'

import type { AfilmorySlotProps } from './afilmory-augment'
import type { AfilmoryManifestPhoto } from './types'
import type { AfilmorySearchParams } from './use-afilmory-manifest'
import {
  useAfilmoryPhotoDirect,
  useAfilmoryPhotosByIds,
  useAfilmoryPhotosSearch,
} from './use-afilmory-manifest'

const DEFAULT_LIMIT_FILTER = 12
const DEFAULT_LIMIT_LIST = 24
const PREVIEW_MAX = 8

function getDisplayAspect(p: AfilmoryManifestPhoto): string {
  if (p.width && p.height) return `${p.width} / ${p.height}`
  return '3 / 2'
}

function isSinglePhoto(props: AfilmorySlotProps): props is AfilmorySlotProps & {
  source: { kind: 'list'; ids: string[] }
} {
  return props.source.kind === 'list' && props.source.ids.length === 1
}

export function AfilmoryBlock(props: AfilmorySlotProps) {
  if (isSinglePhoto(props)) {
    return (
      <SingleBlock
        alt={props.alt}
        baseUrl={props.baseUrl}
        caption={props.caption}
        id={props.source.ids[0]!}
      />
    )
  }
  return <GalleryBlock {...props} />
}

function SingleBlock({
  alt,
  baseUrl,
  caption,
  id,
}: {
  alt?: string
  baseUrl: string
  caption?: string
  id: string
}) {
  const { data, error, isError, isLoading } = useAfilmoryPhotoDirect(
    baseUrl,
    id,
  )
  const aspect = data ? getDisplayAspect(data) : '3 / 2'

  return (
    <figure className="my-4 mx-auto block w-full max-w-md overflow-hidden border border-border bg-surface-inset">
      <div className="relative w-full bg-bg" style={{ aspectRatio: aspect }}>
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center text-fg-muted">
            <Loader2 aria-hidden className="size-5 animate-spin" />
          </div>
        ) : isError || !data ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-fg-muted">
            <Camera aria-hidden className="size-5" />
            <div className="font-mono text-[11px]">
              {error instanceof Error ? error.message : `${id} not found`}
            </div>
          </div>
        ) : (
          <img
            alt={alt ?? caption ?? data.title ?? id}
            className="absolute inset-0 size-full object-cover"
            decoding="async"
            draggable={false}
            loading="lazy"
            src={data.thumbnailUrl}
            style={{ borderRadius: 0 }}
          />
        )}
      </div>
      <figcaption className="flex items-center justify-between gap-2 border-t border-border bg-surface px-3 py-2">
        <span className="truncate text-xs text-fg-muted">
          {caption ?? data?.description ?? id}
        </span>
        <span className="shrink-0 font-mono text-[9px] tracking-[0.12em] text-fg-muted uppercase">
          afilmory · {id}
        </span>
      </figcaption>
    </figure>
  )
}

function useGalleryPhotos(props: AfilmorySlotProps) {
  const { baseUrl, limit, source } = props
  const ids = source.kind === 'list' ? source.ids : []
  const listQuery = useAfilmoryPhotosByIds(baseUrl, ids)

  const searchParams = useMemo<AfilmorySearchParams>(() => {
    if (source.kind !== 'filter') return {}
    return { ...source.filter, limit: limit ?? DEFAULT_LIMIT_FILTER }
  }, [source, limit])
  const filterQuery = useAfilmoryPhotosSearch(baseUrl, searchParams, {
    enabled: source.kind === 'filter',
  })

  if (source.kind === 'list') {
    const photos = listQuery.data ?? []
    const cap = limit ?? DEFAULT_LIMIT_LIST
    return {
      error: listQuery.error,
      isError: listQuery.isError,
      isLoading: listQuery.isLoading,
      photos: cap && photos.length > cap ? photos.slice(0, cap) : photos,
      total: photos.length,
    }
  }
  return {
    error: filterQuery.error,
    isError: filterQuery.isError,
    isLoading: filterQuery.isLoading,
    photos: filterQuery.data?.data ?? [],
    total: filterQuery.data?.total ?? 0,
  }
}

function summarize(props: AfilmorySlotProps, total: number): string {
  const count = `${total} ${total === 1 ? 'photo' : 'photos'}`
  if (props.source.kind === 'list') return count
  const f = props.source.filter
  const parts: string[] = []
  if (f.tags?.length) {
    const sep = f.tagMode === 'intersection' ? ' ∧ ' : ', '
    parts.push(f.tags.map((t) => `#${t}`).join(sep))
  }
  if (f.cameras?.length) parts.push(`📷 ${f.cameras.join(', ')}`)
  if (f.lenses?.length) parts.push(`🔭 ${f.lenses.join(', ')}`)
  if (f.dateFrom || f.dateTo) {
    parts.push(`${f.dateFrom ?? '∞'} → ${f.dateTo ?? '∞'}`)
  }
  if (f.search) parts.push(`"${f.search}"`)
  return parts.length > 0 ? `${count} · ${parts.join(' · ')}` : count
}

function GalleryBlock(props: AfilmorySlotProps) {
  const { caption, title } = props
  const { error, isError, isLoading, photos, total } = useGalleryPhotos(props)
  const preview = photos.slice(0, PREVIEW_MAX)
  const summary = summarize(props, total || preview.length)

  return (
    <figure className="my-4 mx-auto block w-full max-w-2xl overflow-hidden border border-border bg-surface-inset">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Images aria-hidden className="size-4 shrink-0 text-fg-muted" />
          <div className="min-w-0">
            {title ? (
              <div className="truncate text-sm font-medium text-fg">
                {title}
              </div>
            ) : null}
            <div className="truncate font-mono text-[10px] text-fg-muted">
              {summary}
            </div>
          </div>
        </div>
        <span className="shrink-0 font-mono text-[9px] tracking-[0.12em] text-fg-muted uppercase">
          afilmory · {props.source.kind}
        </span>
      </header>
      <div className="p-2">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-fg-muted">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            <span className="font-mono text-[11px]">Loading…</span>
          </div>
        ) : isError ? (
          <div className="py-6 text-center font-mono text-[11px] text-fg-muted">
            {error instanceof Error ? error.message : 'Failed to load'}
          </div>
        ) : preview.length === 0 ? (
          <div className="py-6 text-center font-mono text-[11px] text-fg-muted">
            No photos matched
          </div>
        ) : (
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            }}
          >
            {preview.map((p) => {
              const aspect = getDisplayAspect(p)
              return (
                <div
                  className="relative overflow-hidden bg-bg"
                  key={p.id}
                  style={{ aspectRatio: aspect }}
                >
                  <img
                    alt={p.title ?? p.id}
                    className="absolute inset-0 size-full object-cover"
                    decoding="async"
                    draggable={false}
                    loading="lazy"
                    src={p.thumbnailUrl}
                    style={{ borderRadius: 0 }}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
      {caption ? (
        <figcaption className="border-t border-border px-3 py-2 text-xs text-fg-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}
