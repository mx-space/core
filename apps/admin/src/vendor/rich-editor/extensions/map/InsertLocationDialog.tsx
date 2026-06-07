import 'maplibre-gl/dist/maplibre-gl.css'

import { useMutation } from '@tanstack/react-query'
import { ChevronDown, Loader2, MapPin } from 'lucide-react'
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

import { type GeocodeResult, searchPlaces } from './geocode'
import type { MapNodePayload } from './MapNode'
import { formatLatLon, parseLocationInput } from './parse-location'
import type { MapPoi } from './types'

const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/positron'
const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark'
const DEFAULT_ZOOM = 15
const SEARCH_DEBOUNCE_MS = 350
const MANUAL_PREFIX = '__coords__:'

interface InsertLocationDialogProps {
  initial?: MapNodePayload
  onSubmit: (payload: MapNodePayload) => void
}

interface Pick {
  description?: string
  displayName?: string
  lat: number
  lon: number
}

function pickFromInitial(initial?: MapNodePayload): Pick | null {
  const poi = initial?.pois?.[0]
  if (!poi) return null
  return {
    description: poi.description,
    displayName: poi.title,
    lat: poi.lat,
    lon: poi.lon,
  }
}

function createPinElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.style.width = '20px'
  el.style.height = '20px'
  el.style.background = '#c56473'
  el.style.borderRadius = '50% 50% 50% 0'
  el.style.transform = 'rotate(-45deg)'
  el.style.border = '2px solid #fff'
  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)'
  return el
}

function InsertLocationDialog(props: InsertLocationDialogProps) {
  const modal = useModal<void>()
  const { isDark } = useThemeMode()
  const initialPick = pickFromInitial(props.initial)
  const [title, setTitle] = useState(props.initial?.title ?? '')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [pick, setPick] = useState<Pick | null>(initialPick)
  const [zoom, setZoom] = useState<number>(
    props.initial?.view?.zoom ?? DEFAULT_ZOOM,
  )

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<MapLibreMarker | null>(null)
  const pickRef = useRef<Pick | null>(initialPick)
  const zoomRef = useRef<number>(zoom)
  pickRef.current = pick
  zoomRef.current = zoom

  const baselineRef = useRef({
    title: (props.initial?.title ?? '').trim(),
    pickKey: initialPick ? `${initialPick.lat},${initialPick.lon}` : '',
  })
  const currentPickKey = pick ? `${pick.lat},${pick.lon}` : ''
  const isDirty =
    title.trim() !== baselineRef.current.title ||
    currentPickKey !== baselineRef.current.pickKey ||
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

      const initial = pickRef.current
      map = new maplibre.Map({
        attributionControl: { compact: true },
        center: initial ? [initial.lon, initial.lat] : [139.6917, 35.6895],
        container,
        style: isDark ? DARK_STYLE : LIGHT_STYLE,
        zoom: initial ? zoomRef.current : 2,
      })
      mapRef.current = map

      const placeMarker = (lat: number, lon: number) => {
        if (!map) return
        if (markerRef.current) {
          markerRef.current.setLngLat([lon, lat])
          return
        }
        markerRef.current = new maplibre.Marker({ element: createPinElement() })
          .setLngLat([lon, lat])
          .addTo(map)
      }

      if (initial) placeMarker(initial.lat, initial.lon)

      map.on('click', (event) => {
        const { lat, lng } = event.lngLat
        setPick({ lat, lon: lng })
        placeMarker(lat, lng)
      })

      map.on('zoomend', () => {
        if (map) setZoom(map.getZoom())
      })
    })()

    return () => {
      cancelled = true
      markerRef.current?.remove()
      markerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setStyle(isDark ? DARK_STYLE : LIGHT_STYLE)
  }, [isDark])

  const flyTo = (lat: number, lon: number, z?: number) => {
    const map = mapRef.current
    if (!map) return
    const targetZoom = z ?? Math.max(map.getZoom(), DEFAULT_ZOOM)
    map.flyTo({ center: [lon, lat], zoom: targetZoom, duration: 600 })
  }

  const placeMarkerAt = async (lat: number, lon: number) => {
    const map = mapRef.current
    if (!map) return
    if (markerRef.current) {
      markerRef.current.setLngLat([lon, lat])
      return
    }
    const maplibre = await import('maplibre-gl')
    if (!mapRef.current) return
    markerRef.current = new maplibre.Marker({ element: createPinElement() })
      .setLngLat([lon, lat])
      .addTo(mapRef.current)
  }

  const handleSelect = (r: GeocodeResult) => {
    const isManual = r.type === MANUAL_PREFIX
    const next: Pick = {
      displayName: isManual ? undefined : r.displayName,
      lat: r.lat,
      lon: r.lon,
    }
    setPick(next)
    setQuery('')
    if (!title && !isManual) setTitle(r.displayName.split(',')[0]?.trim() ?? '')
    flyTo(r.lat, r.lon)
    void placeMarkerAt(r.lat, r.lon)
  }

  const onSubmit = () => {
    if (!pick) {
      toast.error('Pick a location first')
      return
    }
    const poi: MapPoi = {
      icon: 'pin',
      lat: pick.lat,
      lon: pick.lon,
      title: title || pick.displayName,
    }
    props.onSubmit({
      pois: [poi],
      title: title || pick.displayName || 'Location',
      view: { center: [pick.lon, pick.lat], zoom },
    })
    modal.close()
  }

  const resultKey = (r: GeocodeResult) =>
    r.type === MANUAL_PREFIX ? MANUAL_PREFIX : `${r.lat},${r.lon}`

  return (
    <div className="flex w-full flex-col">
      <ModalHeader title="Insert location" />
      <div className="grid w-full grid-cols-1 gap-5 px-5 py-5 md:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <TextInput
            autoFocus
            label="Title"
            onChange={setTitle}
            placeholder="e.g. Shibuya Crossing"
            value={title}
          />
          <div className="grid min-w-0 gap-1.5">
            <label className="text-xs font-medium text-fg">Where</label>
            <Combobox
              autoComplete="none"
              filter={null}
              inputValue={query}
              items={items}
              itemToStringLabel={(item) => (item as GeocodeResult).displayName}
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
              Google Maps URL.
            </p>
          </div>
        </div>
        <div className="relative min-h-[320px] min-w-0 overflow-hidden rounded-md border border-border bg-surface-inset">
          <div className="h-full min-h-[320px] w-full" ref={mapContainerRef} />
          {pick && (
            <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-md border border-border bg-surface-overlay/95 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur-sm">
              {pick.displayName && (
                <div className="mb-0.5 truncate font-medium text-fg">
                  {pick.displayName}
                </div>
              )}
              <div className="tabular-nums text-fg-muted">
                {formatLatLon(pick.lat, pick.lon)}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-fg-muted">
          {pick ? (
            <>
              <MapPin
                aria-hidden="true"
                className="size-3.5 shrink-0 text-accent"
              />
              <span className="min-w-0 truncate">
                {pick.displayName ?? 'Pinned'}
              </span>
              <span className="shrink-0 tabular-nums text-fg-subtle">
                · {formatLatLon(pick.lat, pick.lon)}
              </span>
            </>
          ) : (
            'Type or click the map to pick a location'
          )}
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
            disabled={!pick}
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

export function presentInsertLocationDialog(props: InsertLocationDialogProps) {
  return present<InsertLocationDialogProps, void>(InsertLocationDialog, props, {
    modalProps: { popupStyle: { width: 'min(94vw, 54rem)' } },
  })
}
