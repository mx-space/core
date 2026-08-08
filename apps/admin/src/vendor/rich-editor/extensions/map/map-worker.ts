import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

let maplibrePromise: Promise<typeof import('maplibre-gl')> | null = null

export function loadMaplibre() {
  return (maplibrePromise ??= import('maplibre-gl').then((maplibre) => {
    maplibre.setWorkerUrl(workerUrl)
    return maplibre
  }))
}
