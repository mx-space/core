import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Search,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import type {
  AfilmoryFilter,
  AfilmoryLayout,
  AfilmoryListItem,
  AfilmorySource,
} from './afilmory-augment'
import type { AfilmoryPayload } from './afilmory-bridge'
import { FilterPopover } from './FilterPopover'
import { PhotoGrid } from './PhotoGrid'
import type { PhotoFilter } from './picker-helpers'
import {
  applyClientFilter,
  ChipButton,
  deriveFacets,
  EMPTY_FILTER,
  readLastBaseUrl,
  rememberBaseUrl,
  toggleArray,
} from './picker-helpers'
import { normalizeBaseUrl, useAfilmoryManifest } from './use-afilmory-manifest'

interface InsertAfilmoryDialogProps {
  initial?: AfilmoryPayload
  onSubmit: (payload: AfilmoryPayload) => void
}

const LAYOUTS: AfilmoryLayout[] = ['grid', 'masonry', 'carousel']

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

function countActiveFilters(filter: PhotoFilter): number {
  let n = 0
  if (filter.tags.length) n++
  if (filter.cameras.length) n++
  if (filter.lenses.length) n++
  if (filter.dateFrom) n++
  if (filter.dateTo) n++
  return n
}

function InsertAfilmoryDialog(props: InsertAfilmoryDialogProps) {
  const modal = useModal<void>()

  const initialUrl = props.initial?.baseUrl ?? readLastBaseUrl()
  const [committedUrl, setCommittedUrl] = useState(initialUrl)
  const [draftUrl, setDraftUrl] = useState(initialUrl)
  const [editingUrl, setEditingUrl] = useState(false)

  const [title, setTitle] = useState(props.initial?.title ?? '')
  const [caption, setCaption] = useState(props.initial?.caption ?? '')
  const [layout, setLayout] = useState<AfilmoryLayout>(
    props.initial?.layout ?? 'grid',
  )
  const [displayExpanded, setDisplayExpanded] = useState(false)

  const [filter, setFilter] = useState<PhotoFilter>(() =>
    sourceFilterToPicker(props.initial?.source ?? { items: [], kind: 'list' }),
  )

  const initialIds =
    props.initial?.source.kind === 'list'
      ? props.initial.source.items.map((i) => i.id)
      : []
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds)
  const [keepLive, setKeepLive] = useState(
    props.initial?.source.kind === 'filter',
  )

  const manifestQuery = useAfilmoryManifest(committedUrl)
  const allPhotos = manifestQuery.data?.data ?? []
  const facets = useMemo(() => deriveFacets(allPhotos), [allPhotos])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const visiblePhotos = useMemo(
    () => applyClientFilter(allPhotos, filter),
    [allPhotos, filter],
  )

  // When URL changes (not on first open of an edited block), clear selection.
  useEffect(() => {
    if (!props.initial) setSelectedIds([])
  }, [committedUrl, props.initial])

  const activeFilterCount = countActiveFilters(filter)
  const hasFilter = activeFilterCount > 0 || filter.search.trim().length > 0
  const hasSelection = selectedIds.length > 0
  const keepLiveDisabled = hasSelection

  const togglePick = (id: string) =>
    setSelectedIds((prev) => toggleArray(prev, id))

  const clearAllFilters = () => setFilter(EMPTY_FILTER)

  const commitUrl = () => {
    const next = draftUrl.trim()
    if (!next) return
    setCommittedUrl(next)
    setEditingUrl(false)
  }

  const submit = (mode: 'list' | 'filter') => {
    if (!committedUrl) return
    rememberBaseUrl(normalizeBaseUrl(committedUrl))
    let source: AfilmorySource
    if (mode === 'list') {
      if (!hasSelection) return
      const photoById = new Map(allPhotos.map((p) => [p.id, p] as const))
      const items: AfilmoryListItem[] = []
      for (const id of selectedIds) {
        const p = photoById.get(id)
        if (!p) continue
        items.push({
          id,
          w: p.width,
          h: p.height,
          ...(p.thumbHash ? { hash: p.thumbHash } : {}),
        })
      }
      if (items.length === 0) return
      source = { items, kind: 'list' }
    } else {
      const f = pickerFilterToSource(filter)
      if (Object.keys(f).length === 0) return
      source = { filter: f, kind: 'filter' }
    }
    props.onSubmit({
      accent: props.initial?.accent,
      alt: props.initial?.alt,
      baseUrl: normalizeBaseUrl(committedUrl),
      caption: caption.trim() || undefined,
      layout,
      source,
      title: title.trim() || undefined,
    })
    modal.close()
  }

  if (!committedUrl) {
    return (
      <ConnectPane
        draftUrl={draftUrl}
        lastUrl={readLastBaseUrl()}
        onCancel={() => modal.dismiss()}
        onCommit={commitUrl}
        onDraftChange={setDraftUrl}
      />
    )
  }

  const listCtaLabel =
    selectedIds.length === 1
      ? 'Insert photo'
      : `Insert ${selectedIds.length} photos`
  const filterCtaLabel = keepLive ? 'Insert as live filter' : 'Insert as filter'
  const showList = hasSelection
  const showFilter = hasFilter
  const noCta = !showList && !showFilter

  return (
    <div className="flex max-h-[85vh] w-full flex-col overflow-hidden">
      <ModalHeader
        subtitle={
          editingUrl ? null : (
            <UrlBreadcrumb
              onEdit={() => {
                setDraftUrl(committedUrl)
                setEditingUrl(true)
              }}
              url={committedUrl}
            />
          )
        }
        title="Insert afilmory"
      />

      {editingUrl ? (
        <div className="grid shrink-0 gap-2 border-b border-border bg-surface-inset px-5 py-3">
          <TextInput
            autoFocus
            label="Gallery base URL"
            onChange={setDraftUrl}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitUrl()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                setEditingUrl(false)
                setDraftUrl(committedUrl)
              }
            }}
            placeholder="https://innei.afilmory.art"
            value={draftUrl}
          />
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setEditingUrl(false)
                setDraftUrl(committedUrl)
              }}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={!draftUrl.trim()} onClick={commitUrl}>
              Use this URL
            </Button>
          </div>
        </div>
      ) : null}

      <SearchBar
        activeFilterCount={activeFilterCount}
        facets={facets}
        filter={filter}
        setFilter={setFilter}
      />

      {activeFilterCount > 0 ? (
        <ActiveFilterRow
          filter={filter}
          onClear={clearAllFilters}
          setFilter={setFilter}
        />
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto border-y border-border bg-surface-page">
        <PhotoArea
          allCount={allPhotos.length}
          hasFilter={hasFilter}
          loading={manifestQuery.isLoading}
          onTogglePick={togglePick}
          query={manifestQuery}
          selectedSet={selectedSet}
          visiblePhotos={visiblePhotos}
        />
      </div>

      <StatusBar
        allCount={allPhotos.length}
        hasFilter={hasFilter}
        onClearSelection={() => setSelectedIds([])}
        selectedCount={selectedIds.length}
        visibleCount={visiblePhotos.length}
      />

      <DisplayOptions
        caption={caption}
        expanded={displayExpanded}
        layout={layout}
        onCaptionChange={setCaption}
        onLayoutChange={setLayout}
        onTitleChange={setTitle}
        onToggle={() => setDisplayExpanded((v) => !v)}
        title={title}
      />

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {showList && showFilter ? (
            <span className="text-xs text-fg-muted">
              You have both a selection and a filter — pick which to insert.
            </span>
          ) : showFilter ? (
            <KeepLiveCheckbox
              checked={keepLive}
              disabled={keepLiveDisabled}
              onChange={setKeepLive}
            />
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => modal.dismiss()} variant="secondary">
            Cancel
          </Button>
          {noCta ? (
            <Button disabled>Insert</Button>
          ) : (
            <>
              {showFilter ? (
                <Button
                  onClick={() => submit('filter')}
                  variant={showList ? 'secondary' : 'primary'}
                >
                  {filterCtaLabel}
                </Button>
              ) : null}
              {showList ? (
                <Button onClick={() => submit('list')}>{listCtaLabel}</Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ConnectPane({
  draftUrl,
  lastUrl,
  onCancel,
  onCommit,
  onDraftChange,
}: {
  draftUrl: string
  lastUrl: string
  onCancel: () => void
  onCommit: () => void
  onDraftChange: (value: string) => void
}) {
  return (
    <div className="flex w-full flex-col">
      <ModalHeader title="Insert afilmory" />
      <div className="flex flex-col items-center gap-4 px-8 py-10">
        <div className="text-base font-medium text-fg">
          Connect to a gallery
        </div>
        <div className="w-full max-w-md">
          <TextInput
            autoFocus
            onChange={onDraftChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onCommit()
              }
            }}
            placeholder="https://innei.afilmory.art"
            value={draftUrl}
          />
        </div>
        {lastUrl && lastUrl !== draftUrl ? (
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <span>Recent:</span>
            <button
              className="rounded-sm border border-border bg-surface-card px-2 py-0.5 font-mono text-xs text-fg-muted hover:border-border-strong hover:text-fg"
              onClick={() => onDraftChange(lastUrl)}
              type="button"
            >
              {lastUrl.replace(/^https?:\/\//, '')}
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button disabled={!draftUrl.trim()} onClick={onCommit}>
          Continue
        </Button>
      </div>
    </div>
  )
}

function UrlBreadcrumb({ onEdit, url }: { onEdit: () => void; url: string }) {
  const display = url.replace(/^https?:\/\//, '')
  return (
    <button
      className="inline-flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-fg"
      onClick={onEdit}
      title={url}
      type="button"
    >
      <span className="truncate">{display}</span>
      <Pencil aria-hidden className="size-3" />
    </button>
  )
}

function SearchBar({
  activeFilterCount,
  facets,
  filter,
  setFilter,
}: {
  activeFilterCount: number
  facets: ReturnType<typeof deriveFacets>
  filter: PhotoFilter
  setFilter: (next: PhotoFilter) => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface-card px-5 py-3">
      <div className="relative flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
        />
        <input
          className="h-9 w-full rounded-sm border border-border bg-surface-card pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/15"
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && filter.search) {
              e.preventDefault()
              setFilter({ ...filter, search: '' })
            }
          }}
          placeholder="Search id, title, description…"
          type="text"
          value={filter.search}
        />
      </div>
      <FilterPopover
        activeCount={activeFilterCount}
        facets={facets}
        filter={filter}
        setFilter={setFilter}
      />
    </div>
  )
}

function ActiveFilterRow({
  filter,
  onClear,
  setFilter,
}: {
  filter: PhotoFilter
  onClear: () => void
  setFilter: (next: PhotoFilter) => void
}) {
  const chips: Array<{ key: string; label: string; remove: () => void }> = []
  for (const t of filter.tags) {
    chips.push({
      key: `tag:${t}`,
      label: `#${t}`,
      remove: () =>
        setFilter({ ...filter, tags: filter.tags.filter((v) => v !== t) }),
    })
  }
  for (const c of filter.cameras) {
    chips.push({
      key: `cam:${c}`,
      label: `📷 ${c}`,
      remove: () =>
        setFilter({
          ...filter,
          cameras: filter.cameras.filter((v) => v !== c),
        }),
    })
  }
  for (const l of filter.lenses) {
    chips.push({
      key: `lens:${l}`,
      label: `🔭 ${l}`,
      remove: () =>
        setFilter({
          ...filter,
          lenses: filter.lenses.filter((v) => v !== l),
        }),
    })
  }
  if (filter.dateFrom || filter.dateTo) {
    chips.push({
      key: 'date',
      label: `📅 ${filter.dateFrom || '…'} → ${filter.dateTo || '…'}`,
      remove: () => setFilter({ ...filter, dateFrom: '', dateTo: '' }),
    })
  }

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface-inset px-5 py-2">
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {chips.map((chip) => (
          <ChipButton
            active
            key={chip.key}
            label={chip.label}
            onRemove={chip.remove}
          />
        ))}
      </div>
      {filter.tags.length > 1 ? (
        <TagModeInline
          mode={filter.tagMode}
          onChange={(tagMode) => setFilter({ ...filter, tagMode })}
        />
      ) : null}
      <button
        className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
        onClick={onClear}
        type="button"
      >
        <X aria-hidden className="size-3" />
        Clear
      </button>
    </div>
  )
}

function TagModeInline({
  mode,
  onChange,
}: {
  mode: PhotoFilter['tagMode']
  onChange: (m: PhotoFilter['tagMode']) => void
}) {
  return (
    <div className="inline-flex shrink-0 rounded-sm border border-border bg-surface-card p-0.5 text-xs">
      {(['union', 'intersection'] as const).map((m) => (
        <button
          className={cn(
            'rounded-xs px-1.5 py-0.5 transition-colors',
            mode === m ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg',
          )}
          key={m}
          onClick={() => onChange(m)}
          type="button"
        >
          {m === 'union' ? 'any' : 'all'}
        </button>
      ))}
    </div>
  )
}

function PhotoArea({
  allCount,
  hasFilter,
  loading,
  onTogglePick,
  query,
  selectedSet,
  visiblePhotos,
}: {
  allCount: number
  hasFilter: boolean
  loading: boolean
  onTogglePick: (id: string) => void
  query: ReturnType<typeof useAfilmoryManifest>
  selectedSet: Set<string>
  visiblePhotos: ReturnType<typeof applyClientFilter>
}) {
  if (loading) {
    return (
      <CenteredMessage>
        <Loader2 aria-hidden className="size-4 animate-spin" />
        Loading manifest…
      </CenteredMessage>
    )
  }
  if (query.isError) {
    return (
      <CenteredMessage>
        {query.error instanceof Error
          ? query.error.message
          : 'Failed to load manifest'}
      </CenteredMessage>
    )
  }
  if (allCount === 0) {
    return <CenteredMessage>Manifest empty.</CenteredMessage>
  }
  if (visiblePhotos.length === 0) {
    return (
      <CenteredMessage>
        {hasFilter
          ? 'No photos match the current filter.'
          : 'No photos available.'}
      </CenteredMessage>
    )
  }
  return (
    <PhotoGrid
      onToggle={onTogglePick}
      photos={visiblePhotos}
      selectedSet={selectedSet}
    />
  )
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-fg-muted">
      {children}
    </div>
  )
}

function StatusBar({
  allCount,
  hasFilter,
  onClearSelection,
  selectedCount,
  visibleCount,
}: {
  allCount: number
  hasFilter: boolean
  onClearSelection: () => void
  selectedCount: number
  visibleCount: number
}) {
  const right = hasFilter
    ? `${visibleCount} / ${allCount} match`
    : `${allCount} photo${allCount === 1 ? '' : 's'}`
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface-card px-5 py-2 text-xs text-fg-muted">
      <span className="inline-flex items-center gap-2">
        <span>
          <span className="font-medium text-fg">{selectedCount}</span> selected
        </span>
        {selectedCount > 0 ? (
          <button
            className="text-xs text-fg-muted underline-offset-2 hover:text-fg hover:underline"
            onClick={onClearSelection}
            type="button"
          >
            clear
          </button>
        ) : null}
      </span>
      <span className="font-mono">{right}</span>
    </div>
  )
}

function DisplayOptions({
  caption,
  expanded,
  layout,
  onCaptionChange,
  onLayoutChange,
  onTitleChange,
  onToggle,
  title,
}: {
  caption: string
  expanded: boolean
  layout: AfilmoryLayout
  onCaptionChange: (v: string) => void
  onLayoutChange: (l: AfilmoryLayout) => void
  onTitleChange: (v: string) => void
  onToggle: () => void
  title: string
}) {
  const summary = [
    title.trim() ? `“${title.trim()}”` : null,
    caption.trim() ? 'caption' : null,
    `layout: ${layout}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="shrink-0 border-b border-border bg-surface-card">
      <button
        className="flex w-full items-center justify-between gap-3 px-5 py-2 text-left hover:bg-surface-inset focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
        onClick={onToggle}
        type="button"
      >
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-fg">
          {expanded ? (
            <ChevronDown aria-hidden className="size-4" />
          ) : (
            <ChevronRight aria-hidden className="size-4" />
          )}
          Display options
        </span>
        <span className="truncate text-xs text-fg-muted">{summary}</span>
      </button>
      {expanded ? (
        <div className="grid gap-3 border-t border-border px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Title (optional)"
              onChange={onTitleChange}
              placeholder="e.g. 日本 · X-T5"
              value={title}
            />
            <TextInput
              label="Caption (optional)"
              onChange={onCaptionChange}
              placeholder="figcaption / 单图 caption"
              value={caption}
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-fg-muted">
            <span className="font-medium uppercase tracking-wider">Layout</span>
            <div className="inline-flex rounded-sm border border-border bg-surface-card p-0.5">
              {LAYOUTS.map((l) => (
                <button
                  className={cn(
                    'rounded-xs px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors',
                    layout === l
                      ? 'bg-accent text-white'
                      : 'text-fg-muted hover:text-fg',
                  )}
                  key={l}
                  onClick={() => onLayoutChange(l)}
                  type="button"
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function KeepLiveCheckbox({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 text-xs',
        disabled
          ? 'cursor-not-allowed text-fg-subtle'
          : 'cursor-pointer text-fg-muted',
      )}
      title={
        disabled
          ? 'Clear selection to insert as a live filter'
          : 'Insert this as a filter that re-evaluates at render time'
      }
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <span>Keep live</span>
    </label>
  )
}

export function presentInsertAfilmoryDialog(props: InsertAfilmoryDialogProps) {
  return present<InsertAfilmoryDialogProps, void>(InsertAfilmoryDialog, props, {
    modalProps: { popupStyle: { width: 'min(95vw, 56rem)' } },
  })
}
