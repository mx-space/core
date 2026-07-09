import 'maplibre-gl/dist/maplibre-gl.css'

import type { MapMerchant, MapPoi } from '@mx-space/editor'
import { useMutation } from '@tanstack/react-query'
import {
  ChevronDown,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Store,
  X,
} from 'lucide-react'
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useThemeMode } from '~/theme'
import { ModalHeader } from '~/ui/feedback/modal'
import {
  present,
  useDismissGuard,
  useModal,
} from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Combobox } from '~/ui/primitives/combobox'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import {
  type GeocodeResult,
  refetchMerchantForCoords,
  searchPlaces,
} from './geocode'
import type { MapNodePayload } from './MapNode'
import { formatLatLon, parseLocationInput } from './parse-location'

const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/positron'
const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark'
const DEFAULT_ZOOM = 15
const SEARCH_DEBOUNCE_MS = 350
const MANUAL_PREFIX = '__coords__:'

interface InsertLocationDialogProps {
  initial?: MapNodePayload
  onSubmit: (payload: MapNodePayload) => void
}

interface EditingPoi {
  id: string
  title: string
  lat: number | null
  lon: number | null
  displayName?: string
  merchant: MapMerchant | null
  merchantAutoFilled: boolean
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function emptyPoi(): EditingPoi {
  return {
    id: genId(),
    title: '',
    lat: null,
    lon: null,
    merchant: null,
    merchantAutoFilled: false,
  }
}

function fromMapPoi(p: MapPoi): EditingPoi {
  return {
    id: genId(),
    title: p.title ?? '',
    lat: p.lat,
    lon: p.lon,
    displayName: undefined,
    merchant: p.merchant ?? null,
    merchantAutoFilled: false,
  }
}

function createPinElement(active: boolean): HTMLDivElement {
  const el = document.createElement('div')
  el.style.width = '20px'
  el.style.height = '20px'
  el.style.background = active ? '#1c1917' : '#c56473'
  el.style.borderRadius = '50% 50% 50% 0'
  el.style.transform = 'rotate(-45deg)'
  el.style.border = '2px solid #fff'
  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)'
  el.style.zIndex = active ? '10' : '1'
  return el
}

function InsertLocationDialog(props: InsertLocationDialogProps) {
  const modal = useModal<void>()
  const { isDark } = useThemeMode()

  const [pois, setPois] = useState<EditingPoi[]>(() => {
    const init = props.initial?.pois ?? []
    return init.length > 0 ? init.map(fromMapPoi) : [emptyPoi()]
  })
  const [activeIdx, setActiveIdx] = useState(0)
  const [nodeTitle, setNodeTitle] = useState(props.initial?.title ?? '')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [zoom, setZoom] = useState<number>(
    props.initial?.view?.zoom ?? DEFAULT_ZOOM,
  )
  const [mapReady, setMapReady] = useState(false)

  const safeActiveIdx = Math.min(Math.max(activeIdx, 0), pois.length - 1)
  const activePoi = pois[safeActiveIdx] ?? pois[0]!

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const maplibreRef = useRef<typeof import('maplibre-gl') | null>(null)
  const markersRef = useRef<
    Map<string, { marker: MapLibreMarker; el: HTMLDivElement }>
  >(new Map())
  const activeIdxRef = useRef(safeActiveIdx)
  activeIdxRef.current = safeActiveIdx
  const zoomRef = useRef<number>(zoom)
  zoomRef.current = zoom

  const baselineRef = useRef({
    title: (props.initial?.title ?? '').trim(),
    poisKey: serializePois(props.initial?.pois ?? []),
  })
  const currentPoisKey = useMemo(
    () =>
      serializePois(
        pois
          .filter((p) => p.lat != null && p.lon != null)
          .map((p) => ({
            lat: p.lat as number,
            lon: p.lon as number,
            title: p.title,
          })),
      ),
    [pois],
  )
  const isDirty =
    nodeTitle.trim() !== baselineRef.current.title ||
    currentPoisKey !== baselineRef.current.poisKey ||
    query.trim().length > 0
  useDismissGuard(isDirty)

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      SEARCH_DEBOUNCE_MS,
    )
    return () => window.clearTimeout(t)
  }, [query])

  const parsed = useMemo(() => parseLocationInput(query), [query])

  const searchMutation = useMutation({
    mutationFn: ({ q, signal }: { q: string; signal: AbortSignal }) =>
      searchPlaces(q, signal),
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      if (!/aborted/i.test(message)) toast.error(`Search failed: ${message}`)
    },
  })

  useEffect(() => {
    if (parsed || debouncedQuery.length < 2) {
      searchMutation.reset()
      return
    }
    const ctrl = new AbortController()
    searchMutation.mutate({ q: debouncedQuery, signal: ctrl.signal })
    return () => ctrl.abort()
  }, [debouncedQuery, parsed])

  const results = (searchMutation.data ?? []) as GeocodeResult[]
  const isSearching =
    !parsed && searchMutation.isPending && debouncedQuery.length >= 2

  const items = useMemo<GeocodeResult[]>(() => {
    if (parsed) {
      return [
        {
          displayName: `Use coordinates · ${formatLatLon(parsed.lat, parsed.lon)}`,
          lat: parsed.lat,
          lon: parsed.lon,
          type: MANUAL_PREFIX,
        },
      ]
    }
    return results
  }, [parsed, results])

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container) return

    let cancelled = false
    let map: MapLibreMap | null = null

    void (async () => {
      const maplibre = await import('maplibre-gl')
      if (cancelled || !container) return
      maplibreRef.current = maplibre

      const initialActive = pois[0]
      const initialCenter =
        initialActive && initialActive.lat != null && initialActive.lon != null
          ? ([initialActive.lon, initialActive.lat] as [number, number])
          : ([139.6917, 35.6895] as [number, number])

      map = new maplibre.Map({
        attributionControl: { compact: true },
        center: initialCenter,
        container,
        style: isDark ? DARK_STYLE : LIGHT_STYLE,
        zoom: initialActive && initialActive.lat != null ? zoomRef.current : 2,
      })
      mapRef.current = map

      map.on('click', (event) => {
        const { lat, lng } = event.lngLat
        const i = activeIdxRef.current
        setPois((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, lat, lon: lng, displayName: undefined } : p,
          ),
        )
      })

      map.on('zoomend', () => {
        if (map) setZoom(map.getZoom())
      })

      map.on('load', () => {
        if (!cancelled) setMapReady(true)
      })
    })()

    return () => {
      cancelled = true
      for (const { marker } of markersRef.current.values()) marker.remove()
      markersRef.current.clear()
      mapRef.current?.remove()
      mapRef.current = null
      maplibreRef.current = null
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setStyle(isDark ? DARK_STYLE : LIGHT_STYLE)
  }, [isDark])

  useEffect(() => {
    const map = mapRef.current
    const maplibre = maplibreRef.current
    if (!map || !maplibre || !mapReady) return

    const wanted = new Set<string>()
    for (const [i, p] of pois.entries()) {
      if (p.lat == null || p.lon == null) continue
      wanted.add(p.id)
      const isActive = i === safeActiveIdx
      const entry = markersRef.current.get(p.id)
      if (entry) {
        entry.marker.setLngLat([p.lon, p.lat])
        entry.el.style.background = isActive ? '#1c1917' : '#c56473'
        entry.el.style.zIndex = isActive ? '10' : '1'
      } else {
        const el = createPinElement(isActive)
        const marker = new maplibre.Marker({ element: el })
          .setLngLat([p.lon, p.lat])
          .addTo(map)
        markersRef.current.set(p.id, { marker, el })
      }
    }
    for (const [id, entry] of markersRef.current) {
      if (!wanted.has(id)) {
        entry.marker.remove()
        markersRef.current.delete(id)
      }
    }
  }, [pois, safeActiveIdx, mapReady])

  const flyTo = (lat: number, lon: number, z?: number) => {
    const map = mapRef.current
    if (!map) return
    const targetZoom = z ?? Math.max(map.getZoom(), DEFAULT_ZOOM)
    map.flyTo({ center: [lon, lat], zoom: targetZoom, duration: 600 })
  }

  const updateActive = (patch: Partial<EditingPoi>) => {
    setPois((prev) =>
      prev.map((p, idx) =>
        idx === activeIdxRef.current ? { ...p, ...patch } : p,
      ),
    )
  }

  const handleSelect = (r: GeocodeResult) => {
    const isManual = r.type === MANUAL_PREFIX
    setQuery('')
    const patch: Partial<EditingPoi> = {
      lat: r.lat,
      lon: r.lon,
      displayName: isManual ? undefined : r.displayName,
    }
    if (!activePoi.title && !isManual) {
      patch.title = r.displayName.split(',')[0]?.trim() ?? ''
    }
    if (r.merchantSuggestion) {
      patch.merchant = r.merchantSuggestion
      patch.merchantAutoFilled = true
    } else {
      patch.merchantAutoFilled = false
    }
    updateActive(patch)
    flyTo(r.lat, r.lon)
  }

  const refreshMutation = useMutation({
    mutationFn: ({ lat, lon }: { lat: number; lon: number }) =>
      refetchMerchantForCoords(lat, lon),
    onSuccess: (fresh) => {
      if (fresh) {
        updateActive({ merchant: fresh, merchantAutoFilled: true })
        toast.success('Merchant info refreshed from OSM')
      } else {
        toast.message('No OSM merchant data found at this location')
      }
    },
    onError: (err: unknown) => {
      toast.error(
        `Refresh failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    },
  })

  const onMerchantRefresh = () => {
    if (activePoi.lat == null || activePoi.lon == null) return
    refreshMutation.mutate({ lat: activePoi.lat, lon: activePoi.lon })
  }

  const onMerchantToggle = (next: boolean) => {
    if (next) {
      updateActive({ merchant: activePoi.merchant ?? {} })
    } else {
      updateActive({ merchant: null, merchantAutoFilled: false })
    }
  }

  const onAddPlace = () => {
    setPois((prev) => [...prev, emptyPoi()])
    setActiveIdx(pois.length)
  }

  const onSelectPlace = (i: number) => {
    setActiveIdx(i)
    const p = pois[i]
    if (p && p.lat != null && p.lon != null) flyTo(p.lat, p.lon)
  }

  const onRemovePlace = (i: number) => {
    if (pois.length <= 1) {
      setPois([emptyPoi()])
      setActiveIdx(0)
      return
    }
    setPois((prev) => prev.filter((_, idx) => idx !== i))
    if (i <= activeIdx) setActiveIdx(Math.max(0, activeIdx - 1))
  }

  const validPois = pois.filter((p) => p.lat != null && p.lon != null)
  const canSubmit = validPois.length > 0

  const onSubmit = () => {
    if (!canSubmit) {
      toast.error('Pick at least one location')
      return
    }
    const mapPois: MapPoi[] = validPois.map((p) => {
      const m = sanitizeMerchant(p.merchant)
      return {
        icon: 'pin' as const,
        lat: p.lat as number,
        lon: p.lon as number,
        title: p.title.trim() || p.displayName,
        ...(m ? { merchant: m } : {}),
      }
    })
    const nodeT =
      nodeTitle.trim() ||
      mapPois[0]!.title ||
      `${mapPois.length} place${mapPois.length === 1 ? '' : 's'}`
    const view =
      mapPois.length === 1
        ? {
            center: [mapPois[0]!.lon, mapPois[0]!.lat] as [number, number],
            zoom,
          }
        : undefined
    props.onSubmit({
      pois: mapPois,
      title: nodeT,
      ...(view ? { view } : {}),
    })
    modal.close()
  }

  const resultKey = (r: GeocodeResult) =>
    r.type === MANUAL_PREFIX ? MANUAL_PREFIX : `${r.lat},${r.lon}`

  const activeHasCoords = activePoi.lat != null && activePoi.lon != null

  return (
    <div className="flex w-full flex-col">
      <ModalHeader title="Insert location" />
      <div className="grid w-full grid-cols-1 gap-5 px-5 py-5 md:h-[560px] md:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4 md:min-h-0 md:overflow-y-auto md:pr-1">
          <TextInput
            label="Node title (optional)"
            onChange={setNodeTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canSubmit) {
                event.preventDefault()
                onSubmit()
              }
            }}
            placeholder="e.g. Tokyo coffee crawl"
            value={nodeTitle}
          />

          <PlacesStrip
            activeIdx={safeActiveIdx}
            onAdd={onAddPlace}
            onRemove={onRemovePlace}
            onSelect={onSelectPlace}
            pois={pois}
          />

          <div className="grid gap-3 border-t border-border pt-3">
            <TextInput
              autoFocus
              label="Place title"
              onChange={(v) => updateActive({ title: v })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && canSubmit) {
                  event.preventDefault()
                  onSubmit()
                }
              }}
              placeholder="e.g. 上海博物馆"
              value={activePoi.title}
            />
            <div className="grid min-w-0 gap-1.5">
              <label className="text-xs font-medium text-fg">Where</label>
              <Combobox
                autoComplete="none"
                filter={null}
                inputValue={query}
                items={items}
                itemToStringLabel={(item) =>
                  (item as GeocodeResult).displayName
                }
                itemToStringValue={(item) => resultKey(item as GeocodeResult)}
                onInputValueChange={(next) => setQuery(next ?? '')}
                onValueChange={(next) => {
                  if (next && typeof next === 'object' && 'lat' in next)
                    handleSelect(next as GeocodeResult)
                }}
              >
                <Combobox.Control>
                  <Combobox.Input placeholder="Search a place, paste lat,lon or map URL…" />
                  <Combobox.Trigger aria-label="Toggle results">
                    {isSearching ? (
                      <Loader2
                        aria-hidden="true"
                        className="size-3.5 animate-spin"
                      />
                    ) : (
                      <ChevronDown aria-hidden="true" className="size-3.5" />
                    )}
                  </Combobox.Trigger>
                </Combobox.Control>
                <Combobox.Content>
                  <Combobox.Empty>
                    {debouncedQuery.length < 2
                      ? 'Start typing to search'
                      : isSearching
                        ? 'Searching…'
                        : 'No results'}
                  </Combobox.Empty>
                  <Combobox.List className="max-h-60 overflow-auto p-1">
                    {(item: GeocodeResult) => (
                      <Combobox.Item key={resultKey(item)} value={item}>
                        <span className="block min-w-0 truncate">
                          {item.displayName}
                        </span>
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Content>
              </Combobox>
              <p className="text-xs text-fg-muted">
                Type to search, or paste "lat,lon", a{' '}
                <code className="font-mono text-fg-subtle">geo:</code> URI, or a
                Google Maps URL. Click the map to pin manually.
              </p>
            </div>
            <MerchantSection
              autoFilled={activePoi.merchantAutoFilled}
              disabled={!activeHasCoords}
              isRefreshing={refreshMutation.isPending}
              merchant={activePoi.merchant}
              onChange={(next) => updateActive({ merchant: next })}
              onRefresh={onMerchantRefresh}
              onToggle={onMerchantToggle}
            />
          </div>
        </div>
        <div className="relative min-h-[320px] min-w-0 overflow-hidden rounded-md border border-border bg-surface-inset">
          <div className="h-full min-h-[320px] w-full" ref={mapContainerRef} />
          {activeHasCoords && (
            <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-md border border-border bg-surface-overlay/95 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur-sm">
              {activePoi.displayName && (
                <div className="mb-0.5 truncate font-medium text-fg">
                  {activePoi.displayName}
                </div>
              )}
              <div className="tabular-nums text-fg-muted">
                {formatLatLon(activePoi.lat!, activePoi.lon!)}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-fg-muted">
          <MapPin
            aria-hidden="true"
            className="size-3.5 shrink-0 text-accent"
          />
          <span className="min-w-0 truncate">
            {validPois.length === 0
              ? 'Type or click the map to pin a place'
              : `${validPois.length} place${validPois.length === 1 ? '' : 's'} ready`}
          </span>
          {activeHasCoords ? (
            <span className="shrink-0 tabular-nums text-fg-subtle">
              · editing: {formatLatLon(activePoi.lat!, activePoi.lon!)}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            className="h-9"
            onClick={() => modal.dismiss()}
            type="button"
            variant="subtle"
          >
            Cancel
          </Button>
          <Button
            className="h-9"
            disabled={!canSubmit}
            onClick={onSubmit}
            type="button"
          >
            Insert
          </Button>
        </div>
      </div>
    </div>
  )
}

function serializePois(
  arr: Array<{ lat: number; lon: number; title?: string }>,
): string {
  return arr
    .map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}|${p.title ?? ''}`)
    .join(';')
}

function PlacesStrip({
  activeIdx,
  onAdd,
  onRemove,
  onSelect,
  pois,
}: {
  activeIdx: number
  onAdd: () => void
  onRemove: (i: number) => void
  onSelect: (i: number) => void
  pois: EditingPoi[]
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-fg">
          Places ({pois.length})
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {pois.map((p, i) => {
          const isActive = i === activeIdx
          const hasCoords = p.lat != null && p.lon != null
          const label =
            p.title?.trim() ||
            (hasCoords
              ? formatLatLon(p.lat as number, p.lon as number)
              : 'New place')
          return (
            <div
              key={p.id}
              className={cn(
                'inline-flex max-w-full items-center gap-0.5 rounded-sm border px-1.5 py-1 text-xs',
                isActive
                  ? 'border-accent bg-accent/10 text-fg'
                  : 'border-border bg-surface-card text-fg-muted hover:border-border-strong',
                !hasCoords && 'border-dashed',
              )}
            >
              <button
                className="inline-flex max-w-[10rem] items-center gap-1 truncate"
                onClick={() => onSelect(i)}
                type="button"
              >
                <MapPin aria-hidden className="size-3 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
              <button
                aria-label="Remove place"
                className="ml-0.5 inline-flex items-center p-0.5 text-fg-muted hover:text-fg"
                onClick={() => onRemove(i)}
                type="button"
              >
                <X aria-hidden className="size-3" />
              </button>
            </div>
          )
        })}
        <button
          className="inline-flex items-center gap-1 rounded-sm border border-dashed border-border bg-surface-card px-2 py-1 text-xs text-fg-muted hover:border-border-strong hover:text-fg"
          onClick={onAdd}
          type="button"
        >
          <Plus aria-hidden className="size-3" />
          Add
        </button>
      </div>
    </div>
  )
}

function sanitizeMerchant(m: MapMerchant | null): MapMerchant | undefined {
  if (!m) return undefined
  const trim = (v?: string) => {
    const s = (v ?? '').trim()
    return s.length > 0 ? s : undefined
  }
  const address = trim(m.address)
  const phone = trim(m.phone)
  const website = trim(m.website)
  const openingHours = trim(m.openingHours)
  const category = trim(m.category)
  const priceRange = trim(m.priceRange)
  const instagram = trim(m.socialHandles?.instagram)
  const twitter = trim(m.socialHandles?.twitter)
  const tags = (m.tags ?? []).map((t) => t.trim()).filter((t) => t.length > 0)
  const socialHandles =
    instagram || twitter
      ? {
          ...(instagram ? { instagram } : {}),
          ...(twitter ? { twitter } : {}),
        }
      : undefined
  const out: MapMerchant = {
    ...(address ? { address } : {}),
    ...(phone ? { phone } : {}),
    ...(website ? { website } : {}),
    ...(openingHours ? { openingHours } : {}),
    ...(category ? { category } : {}),
    ...(priceRange ? { priceRange } : {}),
    ...(socialHandles ? { socialHandles } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function MerchantSection({
  autoFilled,
  disabled,
  isRefreshing,
  merchant,
  onChange,
  onRefresh,
  onToggle,
}: {
  autoFilled: boolean
  disabled: boolean
  isRefreshing: boolean
  merchant: MapMerchant | null
  onChange: (next: MapMerchant) => void
  onRefresh: () => void
  onToggle: (next: boolean) => void
}) {
  const update = (patch: Partial<MapMerchant>) =>
    onChange({ ...merchant, ...patch })
  const updateSocial = (
    patch: Partial<NonNullable<MapMerchant['socialHandles']>>,
  ) =>
    onChange({
      ...merchant,
      socialHandles: { ...merchant?.socialHandles, ...patch },
    })
  const tagsValue = (merchant?.tags ?? []).join(', ')
  const updateTags = (raw: string) =>
    update({
      tags: raw
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    })

  return (
    <div className="grid gap-2 rounded-md border border-border bg-surface-inset p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-fg">
          <Store aria-hidden className="size-3.5 text-fg-muted" />
          <span>Merchant info</span>
          {merchant && autoFilled ? (
            <span className="rounded-sm bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-accent uppercase">
              auto
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {merchant ? (
            <>
              <button
                aria-label="Refresh from OSM"
                className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-fg-muted hover:bg-surface-card hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled || isRefreshing}
                onClick={onRefresh}
                type="button"
              >
                {isRefreshing ? (
                  <Loader2 aria-hidden className="size-3 animate-spin" />
                ) : (
                  <RefreshCw aria-hidden className="size-3" />
                )}
                <span>Refresh</span>
              </button>
              <button
                aria-label="Remove merchant info"
                className="inline-flex items-center rounded-sm p-1 text-fg-muted hover:bg-surface-card hover:text-fg"
                onClick={() => onToggle(false)}
                type="button"
              >
                <X aria-hidden className="size-3" />
              </button>
            </>
          ) : (
            <button
              className="rounded-sm border border-border bg-surface-card px-2 py-0.5 text-xs text-fg-muted hover:border-border-strong hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled}
              onClick={() => onToggle(true)}
              type="button"
            >
              Mark as merchant
            </button>
          )}
        </div>
      </div>
      {merchant ? (
        <div className="grid gap-2">
          <TextInput
            label="Address"
            onChange={(v) => update({ address: v })}
            placeholder="渋谷区神宮前 5-12-8"
            value={merchant.address ?? ''}
          />
          <div className="grid grid-cols-2 gap-2">
            <TextInput
              label="Phone"
              onChange={(v) => update({ phone: v })}
              placeholder="+81 3-1234-5678"
              value={merchant.phone ?? ''}
            />
            <TextInput
              label="Website"
              onChange={(v) => update({ website: v })}
              placeholder="example.com"
              value={merchant.website ?? ''}
            />
          </div>
          <TextInput
            label="Opening hours"
            onChange={(v) => update({ openingHours: v })}
            placeholder="Mo-Fr 09:00-19:00"
            value={merchant.openingHours ?? ''}
          />
          <div className="grid grid-cols-2 gap-2">
            <TextInput
              label="Category"
              onChange={(v) => update({ category: v })}
              placeholder="cafe"
              value={merchant.category ?? ''}
            />
            <TextInput
              label="Price"
              onChange={(v) => update({ priceRange: v })}
              placeholder="$$"
              value={merchant.priceRange ?? ''}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TextInput
              label="Instagram"
              onChange={(v) => updateSocial({ instagram: v })}
              placeholder="@handle"
              value={merchant.socialHandles?.instagram ?? ''}
            />
            <TextInput
              label="X / Twitter"
              onChange={(v) => updateSocial({ twitter: v })}
              placeholder="@handle"
              value={merchant.socialHandles?.twitter ?? ''}
            />
          </div>
          <TextInput
            label="Tags (comma-separated)"
            onChange={updateTags}
            placeholder="自家烘焙, 手冲, vinyl"
            value={tagsValue}
          />
        </div>
      ) : null}
    </div>
  )
}

export function presentInsertLocationDialog(props: InsertLocationDialogProps) {
  return present<InsertLocationDialogProps, void>(InsertLocationDialog, props, {
    modalProps: { popupStyle: { width: 'min(94vw, 54rem)' } },
  })
}
