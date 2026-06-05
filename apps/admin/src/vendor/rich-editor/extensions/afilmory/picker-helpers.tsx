import type { ReactNode } from 'react'

import type { AfilmoryManifestPhoto } from './types'

export const LAST_BASE_URL_STORAGE_KEY = 'yohaku.afilmory.lastBaseUrl'

export function readLastBaseUrl(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(LAST_BASE_URL_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function rememberBaseUrl(baseUrl: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LAST_BASE_URL_STORAGE_KEY, baseUrl)
  } catch {
    // ignore
  }
}

export function toggleArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

export type FacetEntry = [string, number]

export interface Facets {
  cameras: FacetEntry[]
  lenses: FacetEntry[]
  tags: FacetEntry[]
}

export function deriveFacets(photos: AfilmoryManifestPhoto[]): Facets {
  const tagCounts = new Map<string, number>()
  const cameraCounts = new Map<string, number>()
  const lensCounts = new Map<string, number>()
  for (const p of photos) {
    for (const tag of p.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
    const make = p.exif?.Make?.trim()
    const model = p.exif?.Model?.trim()
    if (make && model) {
      const k = `${make} ${model}`
      cameraCounts.set(k, (cameraCounts.get(k) ?? 0) + 1)
    }
    const lensModel = p.exif?.LensModel?.trim()
    if (lensModel) {
      const lensMake = p.exif?.LensMake?.trim()
      const k = lensMake ? `${lensMake} ${lensModel}` : lensModel
      lensCounts.set(k, (lensCounts.get(k) ?? 0) + 1)
    }
  }
  const sortDesc = (a: FacetEntry, b: FacetEntry) =>
    b[1] - a[1] || a[0].localeCompare(b[0])
  return {
    cameras: [...cameraCounts.entries()].sort(sortDesc),
    lenses: [...lensCounts.entries()].sort(sortDesc),
    tags: [...tagCounts.entries()].sort(sortDesc),
  }
}

export interface PhotoFilter {
  tags: string[]
  tagMode: 'union' | 'intersection'
  cameras: string[]
  lenses: string[]
  search: string
  dateFrom: string
  dateTo: string
}

export function applyClientFilter(
  photos: AfilmoryManifestPhoto[],
  f: PhotoFilter,
): AfilmoryManifestPhoto[] {
  let out = photos
  if (f.tags.length) {
    out =
      f.tagMode === 'intersection'
        ? out.filter((p) => f.tags.every((t) => (p.tags ?? []).includes(t)))
        : out.filter((p) => f.tags.some((t) => (p.tags ?? []).includes(t)))
  }
  if (f.cameras.length) {
    const set = new Set(f.cameras)
    out = out.filter((p) => {
      const make = p.exif?.Make?.trim() ?? ''
      const model = p.exif?.Model?.trim() ?? ''
      if (!make || !model) return false
      return set.has(`${make} ${model}`)
    })
  }
  if (f.lenses.length) {
    const set = new Set(f.lenses)
    out = out.filter((p) => {
      const model = p.exif?.LensModel?.trim() ?? ''
      if (!model) return false
      const make = p.exif?.LensMake?.trim() ?? ''
      const name = make ? `${make} ${model}` : model
      return set.has(name)
    })
  }
  if (f.dateFrom || f.dateTo) {
    const fromTs = f.dateFrom
      ? Date.parse(`${f.dateFrom}T00:00:00.000Z`)
      : Number.NEGATIVE_INFINITY
    const toTs = f.dateTo
      ? Date.parse(`${f.dateTo}T23:59:59.999Z`)
      : Number.POSITIVE_INFINITY
    out = out.filter((p) => {
      const candidates = [
        p.dateTaken,
        p.exif?.DateTimeOriginal,
        // lastModified not in our type; ignore
      ]
      for (const c of candidates) {
        if (!c) continue
        const t = new Date(c).getTime()
        if (Number.isFinite(t)) return t >= fromTs && t <= toTs
      }
      return false
    })
  }
  if (f.search.trim()) {
    const q = f.search.toLowerCase()
    out = out.filter((p) => {
      const hay =
        `${p.title ?? ''} ${p.description ?? ''} ${p.id}`.toLowerCase()
      return hay.includes(q)
    })
  }
  return out
}

export function ChipButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean
  count?: number
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={`inline-flex max-w-[260px] items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] transition ${
        active
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-border bg-surface text-fg-muted hover:border-fg-muted hover:text-fg'
      }`}
      onClick={onClick}
      title={label}
      type="button"
    >
      <span className="min-w-0 truncate">{label}</span>
      {count !== undefined ? (
        <span className="shrink-0 text-[9px] opacity-60">·{count}</span>
      ) : null}
    </button>
  )
}

export function FacetGroup({
  children,
  label,
  suffix,
}: {
  children: ReactNode
  label: string
  suffix?: ReactNode
}) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-medium tracking-wider text-fg-muted uppercase">
          {label}
        </span>
        {suffix}
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

export function TagModeToggle({
  mode,
  onChange,
}: {
  mode: 'union' | 'intersection'
  onChange: (m: 'union' | 'intersection') => void
}) {
  return (
    <button
      className="font-mono text-[10px] text-fg-muted underline hover:text-fg"
      onClick={() => onChange(mode === 'union' ? 'intersection' : 'union')}
      type="button"
    >
      {mode === 'union' ? '并集 (any)' : '交集 (all)'}
    </button>
  )
}

export function formatExifLine(photo: AfilmoryManifestPhoto): string | null {
  const exif = photo.exif
  if (!exif) return null
  const make = exif.Make?.trim()
  const model = exif.Model?.trim()
  const camera = make && model ? `${make} ${model}` : (model ?? '')
  const lens = exif.LensModel?.trim()
  const focal = exif.FocalLength?.replace(/\s*mm$/i, 'mm')
  const aperture = typeof exif.FNumber === 'number' ? `f/${exif.FNumber}` : null
  const shutter = formatShutter(exif.ExposureTime)
  const iso = typeof exif.ISO === 'number' ? `ISO ${exif.ISO}` : null
  const parts = [camera, lens, focal, aperture, shutter, iso].filter(
    (p): p is string => Boolean(p && p.trim()),
  )
  return parts.length > 0 ? parts.join(' · ') : null
}

function formatShutter(s: string | number | undefined | null): string | null {
  if (s === undefined || s === null || s === '') return null
  if (typeof s === 'number') {
    if (!Number.isFinite(s)) return null
    return s >= 1 ? `${s}s` : `1/${Math.round(1 / s)}s`
  }
  const str = String(s)
  if (str.includes('/')) return `${str}s`
  const n = Number(str)
  if (!Number.isFinite(n)) return str
  return n >= 1 ? `${n}s` : `1/${Math.round(1 / n)}s`
}

export function formatDateShort(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}
