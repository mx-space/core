export interface GeocodeResult {
  displayName: string
  lat: number
  lon: number
  type?: string
}

interface NominatimRaw {
  display_name?: string
  lat?: string
  lon?: string
  type?: string
}

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search'

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  limit = 6,
): Promise<GeocodeResult[]> {
  const q = query.trim()
  if (!q) return []
  const url = new URL(NOMINATIM_ENDPOINT)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('addressdetails', '0')
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const data = (await res.json()) as NominatimRaw[]
  return data
    .map((row): GeocodeResult | null => {
      const lat = Number.parseFloat(row.lat ?? '')
      const lon = Number.parseFloat(row.lon ?? '')
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      return {
        displayName: row.display_name ?? `${lat}, ${lon}`,
        lat,
        lon,
        type: row.type,
      }
    })
    .filter((r): r is GeocodeResult => r !== null)
}
