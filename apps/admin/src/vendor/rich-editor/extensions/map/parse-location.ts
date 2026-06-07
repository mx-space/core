export interface ParsedLatLon {
  lat: number
  lon: number
  zoom?: number
}

const LAT_LON_RE = /(-?\d{1,3}(?:\.\d+)?)(?:\s|\s*,)\s*(-?\d{1,3}(?:\.\d+)?)/
const GOOGLE_AT_RE =
  /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)z)?/
const GOOGLE_QUERY_RE = /[&?]q=(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/
const GOOGLE_LL_RE = /[&?]ll=(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/
const GEO_URI_RE = /^geo:(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/i

function inRange(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  )
}

export function parseLocationInput(raw: string): ParsedLatLon | null {
  const text = raw.trim()
  if (!text) return null

  const geo = GEO_URI_RE.exec(text)
  if (geo) {
    const lat = Number.parseFloat(geo[1]!)
    const lon = Number.parseFloat(geo[2]!)
    if (inRange(lat, lon)) return { lat, lon }
  }

  if (/^https?:\/\//i.test(text)) {
    const at = GOOGLE_AT_RE.exec(text)
    if (at) {
      const lat = Number.parseFloat(at[1]!)
      const lon = Number.parseFloat(at[2]!)
      const z = at[3] ? Number.parseFloat(at[3]) : undefined
      if (inRange(lat, lon))
        return z !== undefined ? { lat, lon, zoom: z } : { lat, lon }
    }
    const q = GOOGLE_QUERY_RE.exec(text)
    if (q) {
      const lat = Number.parseFloat(q[1]!)
      const lon = Number.parseFloat(q[2]!)
      if (inRange(lat, lon)) return { lat, lon }
    }
    const ll = GOOGLE_LL_RE.exec(text)
    if (ll) {
      const lat = Number.parseFloat(ll[1]!)
      const lon = Number.parseFloat(ll[2]!)
      if (inRange(lat, lon)) return { lat, lon }
    }
    return null
  }

  const m = LAT_LON_RE.exec(text)
  if (m) {
    const lat = Number.parseFloat(m[1]!)
    const lon = Number.parseFloat(m[2]!)
    if (inRange(lat, lon)) return { lat, lon }
  }
  return null
}

export function formatLatLon(lat: number, lon: number): string {
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`
}
