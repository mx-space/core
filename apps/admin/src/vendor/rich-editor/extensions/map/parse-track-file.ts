import type { GpxPoint } from './gps-compress'
import { isGpxFile, readGpxFile } from './gps-compress'

export interface GpxLeg {
  baseName: string
  id: string
  points: GpxPoint[]
  startTimeMs: number
  tzOffsetMinutes: number | null
}

export type RawPick =
  { legs: GpxLeg[]; type: 'gpx' } | { file: File; type: 'json' }

type ParsedFile = { file: File; type: 'json' } | { leg: GpxLeg; type: 'gpx' }

export async function parseTrackFile(file: File): Promise<ParsedFile> {
  let source = file
  if (!isGpxFile(file)) {
    const text = await file.text()
    if (!/<gpx\b/i.test(text)) return { file, type: 'json' }
    source = new File([text], file.name, { type: 'application/gpx+xml' })
  }
  const { points, tzOffsetMinutes } = await readGpxFile(source)
  const startTimeMs =
    points.find((point) => Number.isFinite(point.timeMs))?.timeMs ??
    Number.POSITIVE_INFINITY
  return {
    leg: {
      baseName: file.name.replace(/\.(gpx|xml)$/i, ''),
      id: crypto.randomUUID(),
      points,
      startTimeMs,
      tzOffsetMinutes,
    },
    type: 'gpx',
  }
}
