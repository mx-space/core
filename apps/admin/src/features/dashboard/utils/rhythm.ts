import type { HeatmapDay } from '~/api/aggregate'

export interface RhythmWeek {
  key: string
  notes: number
  posts: number
  start: Date
}

const weekCount = 52
const dayMs = 86_400_000

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

export function buildWeeklyRhythm(days: HeatmapDay[], now = new Date()) {
  const lastStart = startOfWeek(now)
  const firstStart = new Date(lastStart.getTime() - (weekCount - 1) * 7 * dayMs)
  const weeks: RhythmWeek[] = Array.from({ length: weekCount }, (_, i) => {
    const start = new Date(firstStart.getTime() + i * 7 * dayMs)
    return { key: start.toISOString().slice(0, 10), notes: 0, posts: 0, start }
  })
  for (const day of days) {
    const [y, m, d] = day.date.split('-').map(Number)
    const index = Math.floor(
      (new Date(y, m - 1, d).getTime() - firstStart.getTime()) / (7 * dayMs),
    )
    const week = weeks[index]
    if (!week) continue
    week.posts += day.posts ?? day.count
    week.notes += day.notes ?? 0
  }
  let streak = 0
  for (let i = weeks.length - 1; i >= 0; i -= 1) {
    if (weeks[i].posts + weeks[i].notes === 0) break
    streak += 1
  }
  const last = weeks.at(-1)!
  const months = Array.from({ length: 12 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - offset), 1)
    return { date, key: `${date.getFullYear()}-${date.getMonth() + 1}` }
  })
  return {
    max: Math.max(...weeks.map((week) => week.posts + week.notes)),
    months,
    streak,
    thisWeek: last.posts + last.notes,
    total: weeks.reduce((sum, week) => sum + week.posts + week.notes, 0),
    weeks,
  }
}
