import { describe, expect, it } from 'vitest'

import type { GpxPoint } from './gps-compress'
import { buildLegsTrackJson, buildTrackJson } from './gps-compress'

const T0 = Date.UTC(2026, 9, 2, 0, 0, 0)

function walk(
  startLat: number,
  count: number,
  startMs: number,
  stepMs = 10_000,
): GpxPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    ele: null,
    lat: startLat + i * 0.0005,
    lon: 135,
    timeMs: startMs + i * stepMs,
  }))
}

describe('buildLegsTrackJson', () => {
  const day1 = [...walk(35, 10, T0), ...walk(35.2, 10, T0 + 3 * 3_600_000)]
  const day2 = walk(34.7, 10, T0 + 86_400_000)
  const track = buildLegsTrackJson(
    [
      { points: day1, timezoneOffsetMinutes: 540, title: 'Day 1' },
      { points: day2, title: 'Day 2' },
    ],
    'Trip',
    { sampleTarget: null },
  )

  it('indexes legs over contiguous segment ranges', () => {
    expect(track.segments).toHaveLength(3)
    expect(track.legs?.map((leg) => leg.segments)).toEqual([
      [0, 2],
      [2, 3],
    ])
    expect(track.legs?.map((leg) => leg.title)).toEqual(['Day 1', 'Day 2'])
  })

  it('keeps points equal to the flattened segments', () => {
    expect(track.points).toEqual(track.segments!.flat())
  })

  it('sums distance per segment without bridging gaps', () => {
    const legSum = track.legs!.reduce(
      (sum, leg) => sum + (leg.distanceMeters ?? 0),
      0,
    )
    expect(Math.abs(track.distanceMeters! - legSum)).toBeLessThanOrEqual(1)
    expect(track.distanceMeters!).toBeLessThan(5_000)
  })

  it('spans times across legs and keeps the first timezone', () => {
    expect(track.startTimeMs).toBe(T0)
    expect(track.endTimeMs).toBe(T0 + 86_400_000 + 9 * 10_000)
    expect(track.timezoneOffsetMinutes).toBe(540)
  })

  it('omits legs for a single file', () => {
    const single = buildTrackJson(day1, 'Solo', { sampleTarget: null })
    expect(single.legs).toBeUndefined()
    expect(single.segments).toHaveLength(2)
  })
})
