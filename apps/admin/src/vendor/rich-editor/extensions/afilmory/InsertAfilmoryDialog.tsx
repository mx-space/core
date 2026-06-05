import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { TextInput } from '~/ui/primitives/text-field'

import type {
  AfilmoryFilter,
  AfilmoryLayout,
  AfilmorySource,
} from './afilmory-augment'
import type { AfilmoryPayload } from './afilmory-bridge'
import type { Facets, PhotoFilter } from './picker-helpers'
import {
  applyClientFilter,
  ChipButton,
  deriveFacets,
  FacetGroup,
  formatDateShort,
  formatExifLine,
  readLastBaseUrl,
  rememberBaseUrl,
  TagModeToggle,
  toggleArray,
} from './picker-helpers'
import type { AfilmoryManifestPhoto } from './types'
import { normalizeBaseUrl, useAfilmoryManifest } from './use-afilmory-manifest'

interface InsertAfilmoryDialogProps {
  initial?: AfilmoryPayload
  onSubmit: (payload: AfilmoryPayload) => void
}

type DialogMode = 'list' | 'filter'

const EMPTY_FILTER: PhotoFilter = {
  cameras: [],
  dateFrom: '',
  dateTo: '',
  lenses: [],
  search: '',
  tagMode: 'union',
  tags: [],
}

function PhotoListRow({
  onPick,
  photo,
  selected,
}: {
  onPick: () => void
  photo: AfilmoryManifestPhoto
  selected: boolean
}) {
  const exifLine = formatExifLine(photo)
  const date = formatDateShort(photo.dateTaken ?? photo.exif?.DateTimeOriginal)
  return (
    <div
      aria-pressed={selected}
      className={`flex w-full cursor-pointer items-stretch gap-3 border-b border-border bg-surface px-3 py-2 text-left transition hover:bg-surface-inset ${
        selected ? 'bg-accent/10' : ''
      }`}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPick()
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex shrink-0 items-center">
        <Checkbox
          aria-label={`Toggle ${photo.id}`}
          checked={selected}
          onCheckedChange={() => onPick()}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div className="relative size-16 shrink-0 overflow-hidden bg-bg">
        <img
          alt={photo.title ?? photo.id}
          className="absolute inset-0 size-full object-cover"
          decoding="async"
          draggable={false}
          loading="lazy"
          src={photo.thumbnailUrl}
          style={{ borderRadius: 0 }}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-mono text-[12px] font-medium text-fg">
            {photo.id}
          </span>
          {date ? (
            <span className="shrink-0 font-mono text-[10px] text-fg-muted">
              {date}
            </span>
          ) : null}
        </div>
        {photo.title || photo.description ? (
          <div className="truncate text-[12px] text-fg-muted">
            {photo.description || photo.title}
          </div>
        ) : null}
        {exifLine ? (
          <div className="truncate font-mono text-[10px] text-fg-muted">
            {exifLine}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: DialogMode
  onChange: (m: DialogMode) => void
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
      {(['list', 'filter'] as const).map((m) => (
        <button
          className={`rounded px-3 py-1 text-xs font-medium transition ${
            mode === m
              ? 'bg-accent text-accent-fg'
              : 'text-fg-muted hover:text-fg'
          }`}
          key={m}
          onClick={() => onChange(m)}
          type="button"
        >
          {m === 'list' ? 'List · 手选' : 'Filter · 条件'}
        </button>
      ))}
    </div>
  )
}

function LayoutToggle({
  layout,
  onChange,
}: {
  layout: AfilmoryLayout
  onChange: (l: AfilmoryLayout) => void
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
      {(['grid', 'masonry', 'carousel'] as const).map((l) => (
        <button
          className={`rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
            layout === l ? 'bg-fg/10 text-fg' : 'text-fg-muted hover:text-fg'
          }`}
          key={l}
          onClick={() => onChange(l)}
          type="button"
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function FilterChipsSection({
  facets,
  filter,
  setFilter,
}: {
  facets: Facets
  filter: PhotoFilter
  setFilter: (next: PhotoFilter) => void
}) {
  return (
    <div className="grid gap-2 px-3 py-2">
      <FacetGroup
        label="Tags"
        suffix={
          filter.tags.length > 1 ? (
            <TagModeToggle
              mode={filter.tagMode}
              onChange={(tagMode) => setFilter({ ...filter, tagMode })}
            />
          ) : null
        }
      >
        {facets.tags.length === 0 ? (
          <span className="font-mono text-[10px] text-fg-muted">—</span>
        ) : (
          facets.tags.map(([t, c]) => (
            <ChipButton
              active={filter.tags.includes(t)}
              count={c}
              key={t}
              label={`#${t}`}
              onClick={() =>
                setFilter({ ...filter, tags: toggleArray(filter.tags, t) })
              }
            />
          ))
        )}
      </FacetGroup>
      <FacetGroup label="Cameras">
        {facets.cameras.length === 0 ? (
          <span className="font-mono text-[10px] text-fg-muted">—</span>
        ) : (
          facets.cameras.map(([c, n]) => (
            <ChipButton
              active={filter.cameras.includes(c)}
              count={n}
              key={c}
              label={`📷 ${c}`}
              onClick={() =>
                setFilter({
                  ...filter,
                  cameras: toggleArray(filter.cameras, c),
                })
              }
            />
          ))
        )}
      </FacetGroup>
      <FacetGroup label="Lenses">
        {facets.lenses.length === 0 ? (
          <span className="font-mono text-[10px] text-fg-muted">—</span>
        ) : (
          facets.lenses.map(([l, n]) => (
            <ChipButton
              active={filter.lenses.includes(l)}
              count={n}
              key={l}
              label={`🔭 ${l}`}
              onClick={() =>
                setFilter({
                  ...filter,
                  lenses: toggleArray(filter.lenses, l),
                })
              }
            />
          ))
        )}
      </FacetGroup>
    </div>
  )
}

function FilterInputsRow({
  filter,
  setFilter,
}: {
  filter: PhotoFilter
  setFilter: (next: PhotoFilter) => void
}) {
  return (
    <div className="grid shrink-0 grid-cols-[1fr_auto_auto] items-center gap-2 border-t border-border bg-surface-inset px-3 py-2">
      <input
        className="h-7 rounded-sm border border-border bg-surface px-2 text-xs text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none"
        onChange={(e) => setFilter({ ...filter, search: e.target.value })}
        placeholder="search id / title / desc"
        type="text"
        value={filter.search}
      />
      <input
        className="h-7 w-32 rounded-sm border border-border bg-surface px-2 font-mono text-xs text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none"
        onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
        placeholder="from YYYY-MM-DD"
        type="text"
        value={filter.dateFrom}
      />
      <input
        className="h-7 w-32 rounded-sm border border-border bg-surface px-2 font-mono text-xs text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none"
        onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
        placeholder="to YYYY-MM-DD"
        type="text"
        value={filter.dateTo}
      />
    </div>
  )
}

function pickerFilterToSource(filter: PhotoFilter): AfilmoryFilter {
  const out: AfilmoryFilter = {}
  if (filter.tags.length) out.tags = filter.tags
  if (filter.tagMode === 'intersection' && filter.tags.length) {
    out.tagMode = filter.tagMode
  }
  if (filter.cameras.length) out.cameras = filter.cameras
  if (filter.lenses.length) out.lenses = filter.lenses
  if (filter.dateFrom) out.dateFrom = filter.dateFrom
  if (filter.dateTo) out.dateTo = filter.dateTo
  if (filter.search.trim()) out.search = filter.search.trim()
  return out
}

function sourceFilterToPicker(source: AfilmorySource): PhotoFilter {
  if (source.kind !== 'filter') return EMPTY_FILTER
  const f = source.filter
  return {
    cameras: f.cameras ?? [],
    dateFrom: f.dateFrom ?? '',
    dateTo: f.dateTo ?? '',
    lenses: f.lenses ?? [],
    search: f.search ?? '',
    tagMode: f.tagMode ?? 'union',
    tags: f.tags ?? [],
  }
}

function InsertAfilmoryDialog(props: InsertAfilmoryDialogProps) {
  const modal = useModal<void>()
  const [baseUrl, setBaseUrl] = useState(
    props.initial?.baseUrl ?? readLastBaseUrl(),
  )
  const [mode, setMode] = useState<DialogMode>(
    props.initial?.source.kind === 'filter' ? 'filter' : 'list',
  )
  const [title, setTitle] = useState(props.initial?.title ?? '')
  const [caption, setCaption] = useState(props.initial?.caption ?? '')
  const [layout, setLayout] = useState<AfilmoryLayout>(
    props.initial?.layout ?? 'grid',
  )

  const initialIds =
    props.initial?.source.kind === 'list' ? props.initial.source.ids : []
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds)
  const [filter, setFilter] = useState<PhotoFilter>(() =>
    sourceFilterToPicker(props.initial?.source ?? { ids: [], kind: 'list' }),
  )

  const manifestQuery = useAfilmoryManifest(baseUrl)
  const allPhotos = manifestQuery.data?.data ?? []
  const facets = useMemo(() => deriveFacets(allPhotos), [allPhotos])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const listFilter = useMemo<PhotoFilter>(
    () => (mode === 'list' ? EMPTY_FILTER : filter),
    [mode, filter],
  )
  const visiblePhotos = useMemo(() => {
    if (mode === 'list') return allPhotos
    return applyClientFilter(allPhotos, listFilter)
  }, [mode, allPhotos, listFilter])

  // Reset selection on baseUrl change
  useEffect(() => {
    if (!props.initial) {
      setSelectedIds([])
    }
  }, [baseUrl, props.initial])

  const submit = () => {
    if (!baseUrl) return
    rememberBaseUrl(normalizeBaseUrl(baseUrl))
    let source: AfilmorySource
    if (mode === 'list') {
      if (selectedIds.length === 0) return
      source = { ids: selectedIds, kind: 'list' }
    } else {
      const f = pickerFilterToSource(filter)
      if (Object.keys(f).length === 0) return
      source = { filter: f, kind: 'filter' }
    }
    props.onSubmit({
      accent: props.initial?.accent,
      alt: props.initial?.alt,
      baseUrl: normalizeBaseUrl(baseUrl),
      caption: caption.trim() || undefined,
      layout,
      source,
      title: title.trim() || undefined,
    })
    modal.close()
  }

  const canSubmit =
    mode === 'list'
      ? selectedIds.length > 0
      : Object.keys(pickerFilterToSource(filter)).length > 0

  const insertLabel =
    mode === 'list'
      ? selectedIds.length === 0
        ? 'Insert'
        : selectedIds.length === 1
          ? 'Insert photo'
          : `Insert ${selectedIds.length} photos`
      : 'Insert filter'

  const togglePick = (id: string) => {
    if (mode === 'list') {
      setSelectedIds((prev) => toggleArray(prev, id))
    }
  }

  return (
    <div className="flex max-h-[85vh] w-full flex-col overflow-hidden">
      <ModalHeader title="Insert afilmory" />
      <div className="grid shrink-0 gap-3 px-5 py-4">
        <TextInput
          autoFocus
          label="Gallery base URL"
          onChange={setBaseUrl}
          placeholder="https://innei.afilmory.art"
          value={baseUrl}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="Title (optional)"
            onChange={setTitle}
            placeholder="e.g. 日本 · X-T5"
            value={title}
          />
          <TextInput
            label="Caption (optional)"
            onChange={setCaption}
            placeholder="figcaption / 单图 caption"
            value={caption}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <ModeToggle mode={mode} onChange={setMode} />
          <LayoutToggle layout={layout} onChange={setLayout} />
        </div>
      </div>

      {mode === 'filter' && baseUrl && allPhotos.length > 0 ? (
        <>
          <div className="max-h-[24vh] shrink-0 overflow-y-auto border-b border-border bg-surface-inset">
            <FilterChipsSection
              facets={facets}
              filter={filter}
              setFilter={setFilter}
            />
          </div>
          <FilterInputsRow filter={filter} setFilter={setFilter} />
        </>
      ) : null}

      <div className="grid shrink-0 gap-1.5 px-5 pt-3 pb-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-fg">
            {mode === 'list' ? `Selected: ${selectedIds.length}` : 'Preview'}
          </span>
          <span className="font-mono text-[10px] text-fg-muted">
            {mode === 'list'
              ? `${allPhotos.length} total`
              : `${visiblePhotos.length} / ${allPhotos.length} match`}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-y border-border">
        {!baseUrl ? (
          <p className="px-5 py-10 text-center text-xs text-fg-muted">
            Enter a base URL above to browse the gallery.
          </p>
        ) : manifestQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-12 text-xs text-fg-muted">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Loading manifest…
          </div>
        ) : manifestQuery.isError ? (
          <p className="px-5 py-10 text-center text-xs text-fg-muted">
            {manifestQuery.error instanceof Error
              ? manifestQuery.error.message
              : 'Failed to load manifest'}
          </p>
        ) : visiblePhotos.length === 0 ? (
          <p className="px-5 py-10 text-center text-xs text-fg-muted">
            {mode === 'list'
              ? 'Manifest empty.'
              : 'No photos match the current filter.'}
          </p>
        ) : (
          visiblePhotos.map((p) => (
            <PhotoListRow
              key={p.id}
              onPick={() => togglePick(p.id)}
              photo={p}
              selected={selectedSet.has(p.id)}
            />
          ))
        )}
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4">
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          Cancel
        </Button>
        <Button disabled={!canSubmit} onClick={submit} type="button">
          {insertLabel}
        </Button>
      </div>
    </div>
  )
}

export function presentInsertAfilmoryDialog(props: InsertAfilmoryDialogProps) {
  return present<InsertAfilmoryDialogProps, void>(InsertAfilmoryDialog, props, {
    modalProps: { popupStyle: { width: 'min(95vw, 56rem)' } },
  })
}
