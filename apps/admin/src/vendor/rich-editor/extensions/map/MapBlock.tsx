import 'maplibre-gl/dist/maplibre-gl.css'

import { ArrowRight } from 'lucide-react'
import type { LngLatBoundsLike, Map as MapLibreMap } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '~/utils/cn'

import {
  addPoiLayers,
  addRouteLayers,
  addStopLayers,
  type LayerColors,
  nearestCoordIdx,
  setPoisData,
  setRouteData,
  setStopsData,
  unionBounds,
} from './map-layers'
import type { MapBlockProps, MapTrackData, MapTrackStop } from './types'

const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/positron'
const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark'
const FALLBACK_ACCENT = '#c56473'
const REVEAL_DURATION_MS = 2200

export interface MapBlockViewProps extends MapBlockProps {
  accent?: string
  casing?: string
  isDark?: boolean
}

export function MapBlock({
  accent,
  casing,
  className,
  height = 360,
  interactive = true,
  isDark = false,
  pois: poisProp,
  src,
  title,
  track,
  view,
}: MapBlockViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const styleRef = useRef<LayerColors>({
    accent: accent ?? FALLBACK_ACCENT,
    casing: casing ?? (isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.9)'),
  })
  const revealedRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const [remoteTrack, setRemoteTrack] = useState<MapTrackData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const data = track ?? remoteTrack
  const pois = useMemo(
    () =>
      (poisProp ?? []).filter(
        (poi) => Number.isFinite(poi.lat) && Number.isFinite(poi.lon),
      ),
    [poisProp],
  )
  const coordinates = useMemo(
    () =>
      (data?.points ?? [])
        .map(([lat, lon]) => [lon, lat] as [number, number])
        .filter(([lon, lat]) => Number.isFinite(lat) && Number.isFinite(lon)),
    [data],
  )
  const stops = useMemo(
    () =>
      (data?.stops ?? []).filter(
        (stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lon),
      ),
    [data],
  )

  const hasTrack = coordinates.length >= 2
  const hasPois = pois.length > 0
  const hasContent = hasTrack || hasPois

  useEffect(() => {
    if (!src || track) return

    let cancelled = false
    setLoadError(null)

    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<MapTrackData>
      })
      .then((payload) => {
        if (!cancelled) setRemoteTrack(payload)
      })
      .catch((error) => {
        if (!cancelled) setLoadError(String(error))
      })

    return () => {
      cancelled = true
    }
  }, [src, track])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !hasContent) return

    let cancelled = false
    let map: MapLibreMap | null = null

    void (async () => {
      const maplibre = await import('maplibre-gl')
      if (cancelled) return

      styleRef.current = {
        accent: accent ?? FALLBACK_ACCENT,
        casing:
          casing ?? (isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.9)'),
      }

      map = new maplibre.Map({
        attributionControl: { compact: true },
        cooperativeGestures: interactive,
        container,
        interactive,
        style: isDark ? DARK_STYLE : LIGHT_STYLE,
      })
      mapRef.current = map

      const fixedView =
        view && view.center && typeof view.zoom === 'number' ? view : null
      if (fixedView) {
        map.jumpTo({
          center: fixedView.center as [number, number],
          zoom: fixedView.zoom!,
        })
      } else {
        const bounds = unionBounds(coordinates, pois)
        if (bounds) {
          map.fitBounds(bounds as LngLatBoundsLike, {
            animate: false,
            maxZoom: hasTrack ? 16 : 14,
            padding: 48,
          })
        }
      }

      const ensureLayers = () => {
        const current = mapRef.current
        if (!current) return
        const freshRoute = !current.getSource('map-block-route')
        const freshStops = !current.getSource('map-block-stops')
        const freshPois = !current.getSource('map-block-pois')
        if (freshRoute) addRouteLayers(current, styleRef.current)
        if (freshStops) addStopLayers(current, styleRef.current)
        if (hasPois && freshPois) {
          addPoiLayers(current, styleRef.current)
          setPoisData(current, pois)
        }

        if (revealedRef.current) {
          if (freshRoute && hasTrack) setRouteData(current, coordinates)
          if (freshStops) setStopsData(current, stops)
        } else if (freshRoute && hasTrack) {
          if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
          rafRef.current = animateReveal(
            current,
            coordinates,
            stops,
            REVEAL_DURATION_MS,
            (handle) => {
              if (rafRef.current === handle) rafRef.current = null
              revealedRef.current = true
            },
          )
        } else if (!hasTrack) {
          revealedRef.current = true
        }
      }

      map.on('load', ensureLayers)
      map.on('styledata', ensureLayers)
    })()

    return () => {
      cancelled = true
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      mapRef.current?.remove()
      mapRef.current = null
      revealedRef.current = false
    }
  }, [coordinates, pois])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    styleRef.current = {
      accent: accent ?? FALLBACK_ACCENT,
      casing: casing ?? (isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.9)'),
    }
    map.setStyle(isDark ? DARK_STYLE : LIGHT_STYLE)
  }, [accent, casing, isDark])

  const displayTitle = title ?? data?.title ?? 'Map'

  const distanceLabel = data?.distanceMeters
    ? `${(data.distanceMeters / 1000).toFixed(1)} km`
    : null
  const countLabel = useMemo<React.ReactNode>(() => {
    if (!data) return null
    if (
      data.originalCount &&
      data.sampledCount &&
      data.originalCount !== data.sampledCount
    ) {
      return (
        <span className="inline-flex items-center gap-0.5">
          {data.originalCount.toLocaleString()}
          <ArrowRight aria-hidden className="inline-block size-3" />
          {data.sampledCount.toLocaleString()} pts
        </span>
      )
    }
    if (data.sampledCount) return `${data.sampledCount.toLocaleString()} pts`
    if (coordinates.length > 0)
      return `${coordinates.length.toLocaleString()} pts`
    return null
  }, [coordinates.length, data])

  const dateLabel = useMemo(() => {
    if (!data?.startTimeMs) {
      if (!hasTrack && hasPois) return `${pois.length} places`
      return null
    }
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'long',
      }).format(new Date(data.startTimeMs))
    } catch {
      return new Date(data.startTimeMs).toLocaleDateString()
    }
  }, [data?.startTimeMs, hasPois, hasTrack, pois.length])

  const stopsCount = stops.length
  const hasSecondary = !!(
    dateLabel ||
    distanceLabel ||
    countLabel ||
    stopsCount
  )

  return (
    <figure
      className={cn(
        'my-4 overflow-hidden rounded-lg border border-border bg-surface-card text-fg shadow-sm',
        className,
      )}
    >
      <div className="relative" style={{ height }}>
        <div className="size-full" ref={containerRef} />
        {!hasContent && (
          <div className="absolute inset-0 grid place-items-center bg-surface-card/80 text-sm text-fg-muted backdrop-blur-sm">
            {loadError
              ? `Failed to load track: ${loadError}`
              : 'Loading map...'}
          </div>
        )}
      </div>
      <figcaption className="border-t border-border px-4 py-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-sm font-medium">{displayTitle}</div>
          {hasSecondary && (
            <div className="flex flex-wrap items-center gap-1 text-xs text-fg-muted">
              {joinWithDots(
                [
                  { id: 'date', node: dateLabel },
                  { id: 'distance', node: distanceLabel },
                  { id: 'count', node: countLabel },
                  {
                    id: 'stops',
                    node: stopsCount > 0 ? `${stopsCount} stops` : null,
                  },
                ].filter((item) => Boolean(item.node)),
              )}
            </div>
          )}
        </div>
      </figcaption>
    </figure>
  )
}

function joinWithDots(items: Array<{ id: string; node: React.ReactNode }>) {
  const nodes: React.ReactNode[] = []
  for (const item of items) {
    if (nodes.length > 0) nodes.push(<span key={`sep-${item.id}`}>·</span>)
    nodes.push(<span key={item.id}>{item.node}</span>)
  }
  return nodes
}

function animateReveal(
  map: MapLibreMap,
  coords: Array<[number, number]>,
  stops: MapTrackStop[],
  durationMs: number,
  onDone: (handle: number) => void,
) {
  if (coords.length < 2) return null
  const sortedStops = stops
    .map((stop) => ({ pathIdx: nearestCoordIdx(coords, stop), stop }))
    .sort((a, b) => a.pathIdx - b.pathIdx)
  setStopsData(map, [])

  let revealedStops = 0
  let start: number | null = null
  let handle = 0

  const step = (ts: number) => {
    let routeSource: unknown
    try {
      routeSource = map.getSource('map-block-route')
    } catch {
      return
    }
    if (!routeSource) return
    if (start === null) start = ts
    const raw = Math.min(1, (ts - start) / durationMs)
    const eased = 1 - (1 - raw) ** 3
    const tip = eased * (coords.length - 1)
    const i = Math.floor(tip)
    const frac = tip - i
    const head = coords.slice(0, i + 1)
    if (i < coords.length - 1 && frac > 0) {
      const a = coords[i]!
      const b = coords[i + 1]!
      head.push([a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac])
    }
    setRouteData(map, head)

    let nextRevealed = revealedStops
    while (
      nextRevealed < sortedStops.length &&
      sortedStops[nextRevealed]!.pathIdx <= tip
    ) {
      nextRevealed++
    }
    if (nextRevealed !== revealedStops) {
      revealedStops = nextRevealed
      setStopsData(
        map,
        sortedStops.slice(0, revealedStops).map((entry) => entry.stop),
      )
    }

    if (raw < 1) {
      handle = requestAnimationFrame(step)
    } else {
      if (revealedStops < sortedStops.length) {
        setStopsData(
          map,
          sortedStops.map((entry) => entry.stop),
        )
      }
      onDone(handle)
    }
  }

  handle = requestAnimationFrame(step)
  return handle
}
