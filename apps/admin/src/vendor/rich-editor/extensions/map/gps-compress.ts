import type {
  MapTrackData,
  MapTrackLeg,
  MapTrackPointTuple,
  MapTrackStop,
} from '@mx-space/editor'

export interface GpxPoint {
  ele: number | null
  lat: number
  lon: number
  timeMs?: number | null
}

export interface Bounds {
  diagonalMeters: number
  maxLat: number
  maxLon: number
  minLat: number
  minLon: number
}

export interface DetectStopsOptions {
  clusterRadiusM?: number
  minDwellSec?: number
  minMergedSec?: number
  speedThresholdMps?: number
}

export interface BuildTrackJsonOptions {
  detectStopsOptions?: DetectStopsOptions
  sampleTarget?: number | null
  timezoneOffsetMinutes?: number | null
}

export interface GpxLegInput {
  points: GpxPoint[]
  timezoneOffsetMinutes?: number | null
  title: string
}

export function parseGpx(text: string): GpxPoint[] {
  const points: GpxPoint[] = []
  const trkptRe = /<trkpt\b([^>]*)>(.*?)<\/trkpt>/gs
  let match: RegExpExecArray | null
  while ((match = trkptRe.exec(text))) {
    const lat = Number.parseFloat(readXmlAttr(match[1]!, 'lat') ?? '')
    const lon = Number.parseFloat(readXmlAttr(match[1]!, 'lon') ?? '')
    const inner = match[2] ?? ''
    const eleMatch = /<ele>([^<]+)<\/ele>/.exec(inner)
    const ele = eleMatch ? Number.parseFloat(eleMatch[1]!) : null
    const timeMatch = /<time>([^<]+)<\/time>/.exec(inner)
    const timeMs = timeMatch ? Date.parse(timeMatch[1]!) : Number.NaN
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      points.push({
        ele: Number.isFinite(ele) ? ele : null,
        lat,
        lon,
        timeMs: Number.isFinite(timeMs) ? timeMs : null,
      })
    }
  }
  return points
}

export function extractTimezoneOffsetMinutes(text: string): number | null {
  const match = /<mytracks:timezone\s+offset="(-?\d+(?:\.\d+)?)"/.exec(text)
  if (!match) return null
  const value = Number.parseFloat(match[1]!)
  return Number.isFinite(value) ? value : null
}

export function detectStops(
  points: GpxPoint[],
  options: DetectStopsOptions = {},
): MapTrackStop[] {
  const {
    clusterRadiusM = 80,
    minDwellSec = 60,
    minMergedSec = 600,
    speedThresholdMps = 0.5,
  } = options
  const withTime = points.filter((p): p is GpxPoint & { timeMs: number } =>
    Number.isFinite(p.timeMs),
  )
  if (withTime.length < 3) return []

  type Dwell = {
    durationSec: number
    lat: number
    lon: number
    startMs: number
  }
  const dwells: Dwell[] = []
  let runStart: number | null = null
  for (let i = 1; i < withTime.length; i++) {
    const dtSec = (withTime[i]!.timeMs - withTime[i - 1]!.timeMs) / 1000
    const dM = distanceMeters(withTime[i - 1]!, withTime[i]!)
    const speed = dtSec > 0 ? dM / dtSec : 0
    if (speed <= speedThresholdMps) {
      if (runStart === null) runStart = i - 1
    } else if (runStart !== null) {
      pushDwell(withTime, runStart, i - 1, minDwellSec, dwells)
      runStart = null
    }
  }
  if (runStart !== null) {
    pushDwell(withTime, runStart, withTime.length - 1, minDwellSec, dwells)
  }

  type Cluster = Dwell & { visits: number }
  const clusters: Cluster[] = []
  for (const d of dwells) {
    const hit = clusters.find((c) => distanceMeters(c, d) < clusterRadiusM)
    if (hit) {
      hit.durationSec += d.durationSec
      hit.visits += 1
      if (d.startMs < hit.startMs) hit.startMs = d.startMs
    } else {
      clusters.push({ ...d, visits: 1 })
    }
  }

  return clusters
    .filter((c) => c.durationSec >= minMergedSec)
    .sort((a, b) => a.startMs - b.startMs)
    .map((c) => ({
      durationSec: Math.round(c.durationSec),
      lat: round(c.lat, 6),
      lon: round(c.lon, 6),
      time: new Date(c.startMs).toISOString(),
      visits: c.visits,
    }))
}

function pushDwell(
  points: Array<GpxPoint & { timeMs: number }>,
  startIdx: number,
  endIdx: number,
  minDwellSec: number,
  out: Array<{
    durationSec: number
    lat: number
    lon: number
    startMs: number
  }>,
) {
  const dur = (points[endIdx]!.timeMs - points[startIdx]!.timeMs) / 1000
  if (dur < minDwellSec) return
  out.push({
    durationSec: dur,
    lat: (points[startIdx]!.lat + points[endIdx]!.lat) / 2,
    lon: (points[startIdx]!.lon + points[endIdx]!.lon) / 2,
    startMs: points[startIdx]!.timeMs,
  })
}

export function simplifyToTarget(
  points: GpxPoint[],
  target: number,
): GpxPoint[] {
  if (points.length <= target) return points
  let low = 0
  let high = getBounds(points).diagonalMeters / 12
  let best = points
  for (let i = 0; i < 28; i++) {
    const tolerance = (low + high) / 2
    const simplified = simplifyRdp(points, tolerance)
    if (simplified.length > target) {
      low = tolerance
    } else {
      best = simplified
      high = tolerance
    }
  }
  return best
}

function simplifyRdp(points: GpxPoint[], toleranceMeters: number): GpxPoint[] {
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  simplifyRange(points, 0, points.length - 1, toleranceMeters, keep)
  return points.filter((_, index) => keep[index])
}

function simplifyRange(
  points: GpxPoint[],
  first: number,
  last: number,
  toleranceMeters: number,
  keep: Uint8Array,
) {
  let maxDistance = 0
  let index = first
  for (let i = first + 1; i < last; i++) {
    const distance = pointLineDistance(
      points[i]!,
      points[first]!,
      points[last]!,
    )
    if (distance > maxDistance) {
      maxDistance = distance
      index = i
    }
  }
  if (maxDistance <= toleranceMeters) return
  keep[index] = 1
  simplifyRange(points, first, index, toleranceMeters, keep)
  simplifyRange(points, index, last, toleranceMeters, keep)
}

function pointLineDistance(point: GpxPoint, start: GpxPoint, end: GpxPoint) {
  const p = projectMeters(point, point.lat)
  const a = projectMeters(start, point.lat)
  const b = projectMeters(end, point.lat)
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0 && dy === 0) return distanceMeters(point, start)
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
  )
  const projection = { x: a.x + t * dx, y: a.y + t * dy }
  return Math.hypot(p.x - projection.x, p.y - projection.y)
}

function projectMeters(point: GpxPoint, latRef: number) {
  const metersPerDegreeLat = 111_320
  const metersPerDegreeLon = Math.cos((latRef * Math.PI) / 180) * 111_320
  return {
    x: point.lon * metersPerDegreeLon,
    y: point.lat * metersPerDegreeLat,
  }
}

export function totalDistance(points: GpxPoint[]): number {
  let distance = 0
  for (let i = 1; i < points.length; i++) {
    distance += distanceMeters(points[i - 1]!, points[i]!)
  }
  return distance
}

function distanceMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const earthRadius = 6_371_000
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(h))
}

export function getBounds(points: GpxPoint[]): Bounds {
  const acc = points.reduce(
    (state, point) => ({
      maxLat: Math.max(state.maxLat, point.lat),
      maxLon: Math.max(state.maxLon, point.lon),
      minLat: Math.min(state.minLat, point.lat),
      minLon: Math.min(state.minLon, point.lon),
    }),
    {
      maxLat: points[0]!.lat,
      maxLon: points[0]!.lon,
      minLat: points[0]!.lat,
      minLon: points[0]!.lon,
    },
  )
  return {
    diagonalMeters: Math.round(
      distanceMeters(
        { lat: acc.minLat, lon: acc.minLon },
        { lat: acc.maxLat, lon: acc.maxLon },
      ),
    ),
    maxLat: round(acc.maxLat, 7),
    maxLon: round(acc.maxLon, 7),
    minLat: round(acc.minLat, 7),
    minLon: round(acc.minLon, 7),
  }
}

export function orderTrackPoints(points: GpxPoint[]): GpxPoint[] {
  if (points.length < 2) return points
  if (!points.every((point) => Number.isFinite(point.timeMs))) return points
  for (let i = 1; i < points.length; i++) {
    if (points[i]!.timeMs! < points[i - 1]!.timeMs!) {
      return [...points].sort((a, b) => a.timeMs! - b.timeMs!)
    }
  }
  return points
}

export function splitTrackSegments(
  points: GpxPoint[],
  { breakDistanceMeters = 3_000, breakGapSec = 1_800 } = {},
): GpxPoint[][] {
  if (points.length === 0) return []
  const segments: GpxPoint[][] = [[points[0]!]]
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]!
    const current = points[i]!
    const dtSec =
      Number.isFinite(previous.timeMs) && Number.isFinite(current.timeMs)
        ? (current.timeMs! - previous.timeMs!) / 1000
        : 0
    const shouldBreak =
      dtSec < 0 ||
      (dtSec >= breakGapSec &&
        distanceMeters(previous, current) >= breakDistanceMeters)
    if (shouldBreak) segments.push([current])
    else segments.at(-1)!.push(current)
  }
  return segments
}

export function buildTrackJson(
  points: GpxPoint[],
  title: string,
  options: BuildTrackJsonOptions = {},
): MapTrackData {
  return buildLegsTrackJson(
    [{ points, timezoneOffsetMinutes: options.timezoneOffsetMinutes, title }],
    title,
    options,
  )
}

export function buildLegsTrackJson(
  inputs: GpxLegInput[],
  title: string,
  options: Omit<BuildTrackJsonOptions, 'timezoneOffsetMinutes'> = {},
): MapTrackData {
  const { sampleTarget = 450, detectStopsOptions } = options
  const segments: GpxPoint[][] = []
  const stops: MapTrackStop[] = []
  const legs: MapTrackLeg[] = []
  let originalCount = 0
  let distance = 0

  for (const input of inputs) {
    const ordered = orderTrackPoints(input.points)
    const legSegments = splitTrackSegments(ordered)
    const legDistance = legSegments.reduce(
      (sum, segment) => sum + totalDistance(segment),
      0,
    )
    const startTimeMs = firstFinite(ordered.map((p) => p.timeMs ?? null))
    const endTimeMs = lastFinite(ordered.map((p) => p.timeMs ?? null))
    legs.push({
      distanceMeters: Math.round(legDistance),
      ...(typeof endTimeMs === 'number' && { endTimeMs }),
      segments: [segments.length, segments.length + legSegments.length],
      ...(typeof startTimeMs === 'number' && { startTimeMs }),
      title: input.title,
    })
    segments.push(...legSegments)
    stops.push(...detectStops(ordered, detectStopsOptions))
    originalCount += ordered.length
    distance += legDistance
  }

  const sampledSegments =
    sampleTarget && originalCount > sampleTarget
      ? segments.map((segment) =>
          simplifyToTarget(
            segment,
            Math.max(
              2,
              Math.round((sampleTarget * segment.length) / originalCount),
            ),
          ),
        )
      : segments
  const sampled = sampledSegments.flat()
  const startTimes = legs.flatMap((leg) => leg.startTimeMs ?? [])
  const endTimes = legs.flatMap((leg) => leg.endTimeMs ?? [])
  const timezoneOffsetMinutes = inputs.find(
    (input) => typeof input.timezoneOffsetMinutes === 'number',
  )?.timezoneOffsetMinutes

  return {
    bounds: getBounds(sampled),
    distanceMeters: Math.round(distance),
    ...(endTimes.length > 0 && { endTimeMs: Math.max(...endTimes) }),
    ...(legs.length > 1 && { legs }),
    originalCount,
    points: sampled.map(toTuple),
    sampledCount: sampled.length,
    segments: sampledSegments.map((segment) => segment.map(toTuple)),
    ...(startTimes.length > 0 && { startTimeMs: Math.min(...startTimes) }),
    ...(stops.length > 0 && {
      stops: stops.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    }),
    ...(typeof timezoneOffsetMinutes === 'number' && {
      timezoneOffsetMinutes,
    }),
    title,
    version: 1,
  }
}

function toTuple(point: GpxPoint): MapTrackPointTuple {
  return [
    round(point.lat, 7),
    round(point.lon, 7),
    point.ele === null ? null : round(point.ele, 1),
  ]
}

export function isGpxFile(file: { name: string; type: string }): boolean {
  return /\.gpx$/i.test(file.name) || file.type === 'application/gpx+xml'
}

export async function readGpxFile(file: File): Promise<{
  points: GpxPoint[]
  tzOffsetMinutes: number | null
}> {
  const text = await file.text()
  const points = parseGpx(text)
  if (points.length === 0) {
    throw new Error('No valid GPS points found in file')
  }
  return { points, tzOffsetMinutes: extractTimezoneOffsetMinutes(text) }
}

export function buildTrackFile(
  baseFileName: string,
  points: GpxPoint[],
  options: BuildTrackJsonOptions = {},
): { file: File; trackData: MapTrackData } {
  return trackDataToFile(
    baseFileName,
    buildTrackJson(points, baseFileName, options),
  )
}

export function trackDataToFile(
  baseFileName: string,
  trackData: MapTrackData,
): { file: File; trackData: MapTrackData } {
  const jsonBlob = new Blob([JSON.stringify(trackData)], {
    type: 'application/json',
  })
  const file = new File([jsonBlob], `${baseFileName}.json`, {
    type: 'application/json',
  })
  return { file, trackData }
}

function firstFinite(values: Array<number | null | undefined>): number | null {
  for (const v of values)
    if (typeof v === 'number' && Number.isFinite(v)) return v
  return null
}

function lastFinite(values: Array<number | null | undefined>): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return null
}

function readXmlAttr(source: string, name: string) {
  const match = new RegExp(`${name}="([^"]+)"`).exec(source)
  return match?.[1] ?? null
}

function round(value: number, digits: number) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function toRad(value: number) {
  return (value * Math.PI) / 180
}
