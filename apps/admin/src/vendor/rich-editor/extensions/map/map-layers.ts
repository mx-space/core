import type { MapPoi, MapTrackStop } from '@mx-space/editor'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'

export const ROUTE_SOURCE = 'map-block-route'
export const ROUTE_LAYER_CASING = 'map-block-route-casing'
export const ROUTE_LAYER = 'map-block-route-line'
export const STOPS_SOURCE = 'map-block-stops'
export const STOPS_LAYER_HALO = 'map-block-stops-halo'
export const STOPS_LAYER = 'map-block-stops-dot'
export const POIS_SOURCE = 'map-block-pois'
export const POIS_HALO_LAYER = 'map-block-pois-halo'
export const POIS_PIN_LAYER = 'map-block-pois-pin'
export const POIS_LABEL_LAYER = 'map-block-pois-label'

export interface LayerColors {
  accent: string
  casing: string
}

export function addRouteLayers(map: MapLibreMap, colors: LayerColors) {
  map.addSource(ROUTE_SOURCE, { data: emptyLine(), type: 'geojson' })
  map.addLayer({
    id: ROUTE_LAYER_CASING,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': colors.casing,
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 18, 10],
    },
    source: ROUTE_SOURCE,
    type: 'line',
  })
  map.addLayer({
    id: ROUTE_LAYER,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': colors.accent,
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 18, 6],
    },
    source: ROUTE_SOURCE,
    type: 'line',
  })
}

export function addStopLayers(map: MapLibreMap, colors: LayerColors) {
  map.addSource(STOPS_SOURCE, { data: emptyCollection(), type: 'geojson' })
  map.addLayer({
    id: STOPS_LAYER_HALO,
    paint: {
      'circle-color': colors.accent,
      'circle-opacity': 0.16,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 16, 22],
    },
    source: STOPS_SOURCE,
    type: 'circle',
  })
  map.addLayer({
    id: STOPS_LAYER,
    paint: {
      'circle-color': colors.accent,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 16, 7],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.6,
    },
    source: STOPS_SOURCE,
    type: 'circle',
  })
}

export function addPoiLayers(map: MapLibreMap, colors: LayerColors) {
  map.addSource(POIS_SOURCE, { data: emptyCollection(), type: 'geojson' })
  map.addLayer({
    id: POIS_HALO_LAYER,
    paint: {
      'circle-color': colors.accent,
      'circle-opacity': 0.2,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 16, 28],
    },
    source: POIS_SOURCE,
    type: 'circle',
  })
  map.addLayer({
    id: POIS_PIN_LAYER,
    paint: {
      'circle-color': colors.accent,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 16, 10],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2.4,
    },
    source: POIS_SOURCE,
    type: 'circle',
  })
  map.addLayer({
    id: POIS_LABEL_LAYER,
    layout: {
      'text-anchor': 'top',
      'text-field': ['coalesce', ['get', 'title'], ''],
      'text-font': ['Noto Sans Regular'],
      'text-offset': [0, 1.1],
      'text-size': 12,
    },
    paint: {
      'text-color': '#000000',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1,
    },
    source: POIS_SOURCE,
    type: 'symbol',
  })
}

export function setRouteData(
  map: MapLibreMap,
  coords: Array<[number, number]>,
) {
  const src = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined
  src?.setData({
    geometry: { coordinates: coords, type: 'LineString' },
    properties: {},
    type: 'Feature',
  })
}

export function setStopsData(map: MapLibreMap, stops: MapTrackStop[]) {
  const src = map.getSource(STOPS_SOURCE) as GeoJSONSource | undefined
  src?.setData({
    features: stops.map((stop) => ({
      geometry: { coordinates: [stop.lon, stop.lat], type: 'Point' },
      properties: {
        duration: stop.durationSec,
        time: stop.time ?? null,
        visits: stop.visits ?? 1,
      },
      type: 'Feature',
    })),
    type: 'FeatureCollection',
  })
}

export function setPoisData(map: MapLibreMap, pois: MapPoi[]) {
  const src = map.getSource(POIS_SOURCE) as GeoJSONSource | undefined
  src?.setData({
    features: pois.map((poi, index) => ({
      geometry: { coordinates: [poi.lon, poi.lat], type: 'Point' },
      properties: {
        description: poi.description ?? null,
        index,
        title: poi.title ?? '',
      },
      type: 'Feature',
    })),
    type: 'FeatureCollection',
  })
}

export function emptyLine() {
  return {
    geometry: {
      coordinates: [] as Array<[number, number]>,
      type: 'LineString' as const,
    },
    properties: {},
    type: 'Feature' as const,
  }
}

export function emptyCollection() {
  return { features: [], type: 'FeatureCollection' as const }
}

export function unionBounds(
  coords: Array<[number, number]>,
  pois: MapPoi[],
): [[number, number], [number, number]] | null {
  if (coords.length === 0 && pois.length === 0) return null
  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY
  let minLon = Number.POSITIVE_INFINITY
  let maxLon = Number.NEGATIVE_INFINITY
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  for (const poi of pois) {
    if (poi.lon < minLon) minLon = poi.lon
    if (poi.lon > maxLon) maxLon = poi.lon
    if (poi.lat < minLat) minLat = poi.lat
    if (poi.lat > maxLat) maxLat = poi.lat
  }
  if (!Number.isFinite(minLat) || !Number.isFinite(minLon)) return null
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ]
}

export function nearestCoordIdx(
  coords: Array<[number, number]>,
  stop: { lat: number; lon: number },
): number {
  let bestIdx = 0
  let bestDist = Number.POSITIVE_INFINITY
  for (let i = 0; i < coords.length; i++) {
    const dx = coords[i]![0] - stop.lon
    const dy = coords[i]![1] - stop.lat
    const dist = dx * dx + dy * dy
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
  }
  return bestIdx
}
