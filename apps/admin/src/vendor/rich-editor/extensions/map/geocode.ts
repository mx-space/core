import type { MapMerchant } from './types'

export interface GeocodeResult {
  displayName: string
  lat: number
  lon: number
  type?: string
  merchantSuggestion?: MapMerchant
}

interface NominatimAddress {
  city?: string
  town?: string
  village?: string
  hamlet?: string
  county?: string
  state?: string
  country?: string
  house_number?: string
  road?: string
  pedestrian?: string
  postcode?: string
  suburb?: string
  neighbourhood?: string
}

interface NominatimRaw {
  address?: NominatimAddress
  class?: string
  display_name?: string
  extratags?: Record<string, string>
  lat?: string
  lon?: string
  type?: string
}

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search'

const MERCHANT_CLASSES = new Set([
  'amenity',
  'shop',
  'craft',
  'tourism',
  'leisure',
  'office',
])

function joinAddress(addr: NominatimAddress | undefined): string | undefined {
  if (!addr) return undefined
  const street = [addr.road ?? addr.pedestrian, addr.house_number]
    .filter(Boolean)
    .join(' ')
    .trim()
  const city =
    addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? addr.suburb
  const parts = [
    street,
    addr.neighbourhood,
    city,
    addr.state,
    addr.country,
  ].filter((p): p is string => Boolean(p && p.trim()))
  return parts.length > 0 ? parts.join(', ') : undefined
}

function pickTag(
  extratags: Record<string, string> | undefined,
  keys: string[],
): string | undefined {
  if (!extratags) return undefined
  for (const k of keys) {
    const v = extratags[k]
    if (v && v.trim()) return v.trim()
  }
  return undefined
}

function buildMerchantFromOsm(row: NominatimRaw): MapMerchant | undefined {
  const tags = row.extratags ?? {}
  const isMerchantClass = row.class ? MERCHANT_CLASSES.has(row.class) : false
  const hasMerchantTags = Boolean(
    pickTag(tags, ['phone', 'contact:phone']) ||
    pickTag(tags, ['website', 'contact:website', 'url']) ||
    tags.opening_hours ||
    pickTag(tags, ['contact:instagram']) ||
    pickTag(tags, ['contact:twitter', 'contact:x']),
  )

  if (!isMerchantClass && !hasMerchantTags) return undefined

  const address = joinAddress(row.address)
  const phone = pickTag(tags, ['phone', 'contact:phone'])
  const website = pickTag(tags, ['website', 'contact:website', 'url'])
  const openingHours = tags.opening_hours?.trim() || undefined
  const category =
    row.type && row.type.trim()
      ? row.type.trim()
      : row.class && row.class.trim()
        ? row.class.trim()
        : undefined
  const instagram = pickTag(tags, ['contact:instagram'])
  const twitter = pickTag(tags, ['contact:twitter', 'contact:x'])

  const socialHandles =
    instagram || twitter
      ? {
          ...(instagram ? { instagram } : {}),
          ...(twitter ? { twitter } : {}),
        }
      : undefined

  const merchant: MapMerchant = {
    ...(address ? { address } : {}),
    ...(phone ? { phone } : {}),
    ...(website ? { website } : {}),
    ...(openingHours ? { openingHours } : {}),
    ...(category ? { category } : {}),
    ...(socialHandles ? { socialHandles } : {}),
  }

  return Object.keys(merchant).length > 0 ? merchant : undefined
}

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
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('extratags', '1')
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
      const merchantSuggestion = buildMerchantFromOsm(row)
      return {
        displayName: row.display_name ?? `${lat}, ${lon}`,
        lat,
        lon,
        type: row.type,
        ...(merchantSuggestion ? { merchantSuggestion } : {}),
      }
    })
    .filter((r): r is GeocodeResult => r !== null)
}

export async function refetchMerchantForCoords(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<MapMerchant | undefined> {
  const results = await searchPlaces(`${lat},${lon}`, signal, 1)
  return results[0]?.merchantSuggestion
}
